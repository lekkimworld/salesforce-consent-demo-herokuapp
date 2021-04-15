import { Application, Router } from "express";
import { Issuer, generators, custom, Client } from "openid-client";
import readEnvironment from "./environment";
import { HttpException } from "./types";
import renderTemplate from "./ui_helper";
import fetch from "node-fetch";
import { getSalesforceDataService } from "./fetch_util";
import { pathToFileURL } from "node:url";

const env = readEnvironment();

// discover OIDC data and cache
let oidcdata: Issuer<Client>;
export const discoverOidcData = async () => {
    if (oidcdata) return Promise.resolve(oidcdata);
    console.log("Performing OIDC Discovery...");
    oidcdata = await Issuer.discover(env.oidc.providerUrl);
    console.log("Discovered OIDC Endpoint data");
    return Promise.resolve(oidcdata);
};

// build OpenID client
export const getOidcClient = async () => {
    // discover issuer
    const oidcIssuer = await discoverOidcData();

    // create client
    const client = new oidcIssuer.Client({
        client_id: env.oidc.clientId,
        client_secret: env.oidc.clientSecret,
        redirect_uris: [env.oidc.redirectUri],
        response_types: ["code"],
    });
    return client;
};

export class AuthenticatedUser {
    fn: string;
    ln: string;
    fullname: string;
    id: string;
    active: boolean;
    photo: string;
    userinfo: any;
    termsAccepted: boolean = false;
    termsVersion: string | undefined;

    constructor(userinfo: any) {
        this.fn = userinfo.given_name;
        this.ln = userinfo.family_name;
        this.fullname = userinfo.name;
        this.id = userinfo.user_id;
        this.active = userinfo.active;
        this.photo = userinfo.photos.picture;
        this.userinfo = userinfo;
    }
}

/**
 * Browser payload when browser is asking for a OpenID Connect Provider
 * login url.
 *
 */
export interface AuthenticationUrlPayload {
    url: string;
}

/**
 * Derivative of AuthenticationUrlPayload to extend with the nonce
 * used during the OpenID Connect authentication flow.
 */
export interface AuthenticationUrlWithNonce extends AuthenticationUrlPayload {
    nonce: string;
}

export const getAuthenticationUrl = async () => {
    // generate nonce and auth url
    const nonce = generators.nonce();

    // get client
    const client = await getOidcClient();

    // get auth URL
    let url = client.authorizationUrl({
        scope: env.oidc.scopes,
        nonce: nonce,
        prompt: "login",
    });

    return {
        url: url,
        nonce: nonce,
    } as AuthenticationUrlWithNonce;
};

export const ensureAuthenticated = (app: Application) => {
    app.use(async (req, res, next) => {
        if (req.path.indexOf(".js") > 0) return next();
        if (!req.session || !req.session.user) {
            // no session with the server
            if (req.path.startsWith("/oidc/login")) {
                // user is attempting to login - get url and redirect
                const authurl = await getAuthenticationUrl();
                req.session.oidc_nonce = authurl.nonce;
                return res.redirect(authurl.url);
            }
            if (req.path.startsWith("/oidc/callback")) {
                // calling back
                return next();
            }

            // send to front page
            return renderTemplate(res, "unauth_root");
        }

        // user is authenticated
        res.locals.user = req.session.user;

        // see if call for terms endpoints
        if (req.path.startsWith("/terms/accept")) {
            req.session.user!.termsAccepted = true;
            return res.redirect("/");
        } else if (req.path.startsWith("/terms/decline")) {
            // logout the user
            return req.session.destroy((err?) => {
                res.redirect("/");
            });
        }

        // ensure terms and conditions
        if (req.session.user.termsAccepted) return next();

        // we do not know if terms accepted - ask salesforce
        const tc = await getSalesforceDataService(
            `/consent/action/social?ids=${req.session.user.id}&verbose&purpose=${env.terms_purpose}`
        );

        // grab the first response (error in Salesforce API response)
        const tcdata = tc[Object.keys(tc)[0]];
        if (tcdata.result === "Success") {
            // user has accepted terms and conditions
            req.session.user.termsAccepted = true;
        }

        // see if terms accepted
        if (!req.session.user.termsAccepted)
            return renderTemplate(res, "terms");

        // all is okay - forward to application
        next();
    });
};

export default (app: Application) => {
    // create a router
    const router = Router();

    router.get("/logout", async (req, res, next) => {
        return req.session.destroy((err?) => {
            return res.redirect("/");
        });
    });

    /**
     * Callback from the OIDC provider.
     *
     */
    router.get("/callback", async (req, res, next) => {
        const nonce = req.session.oidc_nonce;
        if (!nonce) return next(new HttpException(417, `No nonce found`));

        // get client
        console.log("Retrieving OIDC client");
        const oidcClient = await getOidcClient();
        console.log("Retrieve OIDC client");

        // get params
        const callbackParams = oidcClient.callbackParams(req);
        const callbackExtras = {};

        try {
            // get tokenset
            const tokenSet = await oidcClient.callback(
                env.oidc.redirectUri,
                callbackParams,
                { nonce },
                callbackExtras
            );
            console.log("Performed OIDC callback and retrieved tokenset");

            // get userinfo
            const userinfo = await oidcClient.userinfo(tokenSet);

            // ensure we have a row in LOGIN_USER for the user
            req.session.user = new AuthenticatedUser(userinfo);

            // redirect
            res.redirect("/");
        } catch (err) {
            return next(
                new HttpException(
                    417,
                    `Unable to perform callback (${err}`,
                    err
                )
            );
        }
    });

    // add router for OIDC
    app.use("/oidc", router);
};
