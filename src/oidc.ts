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

export class TermsData {
    tos: boolean = false;
    telemetry: boolean = false;
    order: boolean = false;
    newsletter: boolean = false;
}

export class AuthenticatedUser {
    fn: string;
    ln: string;
    fullname: string;
    id: string;
    active: boolean;
    photo: string;
    userinfo: any;
    terms?: TermsData;

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

const updateUserTerms = (
    user: AuthenticatedUser,
    tos: boolean,
    telemetry: boolean,
    order: boolean,
    newsletter: boolean
) => {
    if (!user.terms) user.terms = new TermsData();
    console.log(
        `Setting terms - tos: ${tos}, telemetry: ${telemetry}, order: ${order}, newsletter: ${newsletter}`
    );
    user.terms.tos = tos;
    user.terms.telemetry = telemetry;
    user.terms.order = order;
    user.terms.newsletter = newsletter;
};
const isTermsOfServiceAccepted = (user: AuthenticatedUser) => {
    return user.terms && user.terms.tos;
};
const writeConsentToSalesforce = async (
    user: AuthenticatedUser,
    _telemetry: boolean,
    _order: boolean,
    _newsletter: boolean
) => {
    await readConsentFromSalesforce(user);
};
const readConsentFromSalesforce = async (user: AuthenticatedUser) => {
    const tc = await getSalesforceDataService(
        `/consent/action/process?ids=${user.id}&verbose`
    );
    console.log(`Read Salesforce Consent data for user: ${user.id}`);
    console.log(JSON.stringify(tc, undefined, 2));

    // grab the first response (error in Salesforce API response) and parse data
    const tcdata = tc[Object.keys(tc)[0]];
    if (tcdata.result === "Success") {
        // found user data - update terms object from Salesforce
        const determineValue = (records: any[], purpose: string) => {
            return records.reduce((prev: boolean, r: any) => {
                if (prev === true) return prev;
                if (
                    r.objectConsulted === "ContactPointTypeConsent" &&
                    r.purpose === purpose
                )
                    return r.value === "OPT_IN";
                return false;
            }, false);
        };
        const tos = determineValue(tcdata.explanation, "Terms of Service");
        const telemetry = determineValue(tcdata.explanation, "Telemetry");
        const order = determineValue(tcdata.explanation, "Online Order");
        const newsletter = determineValue(tcdata.explanation, "Newsletter");
        updateUserTerms(user, tos, telemetry, order, newsletter);
    } else {
        throw new HttpException(
            417,
            "Unable to read consent data for user from Salesforce",
            undefined
        );
    }
};

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
        prompt: env.oidc.prompt,
    });
    console.log(`Using OIDC URL: ${url}`);

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
            const match_result = req.path.match(
                /\/terms\/accept\/(true|false)\/(true|false)\/(true|false)\/?/
            );
            if (!match_result)
                throw new HttpException(
                    417,
                    "Invalid format for /terms/accept",
                    undefined
                );

            // get consent elements
            const telemetry = match_result[1] === "true";
            const order = match_result[2] === "true";
            const newsletter = match_result[3] === "true";

            // write data to salesforce
            await writeConsentToSalesforce(
                req.session.user,
                telemetry,
                order,
                newsletter
            );

            // redirect back to app
            return res.redirect("/");
        } else if (req.path.startsWith("/terms/decline")) {
            // logout the user
            return req.session.destroy((err?) => {
                res.redirect("/");
            });
        }

        // if we do not have the terms yet - redirect to terms page
        if (!req.session.user.terms) return renderTemplate(res, "terms");

        // we do not know if terms - ask salesforce
        await readConsentFromSalesforce(req.session.user);

        // ensure user accepted terms of service
        if (!isTermsOfServiceAccepted(req.session.user)) {
            console.log("User has not accepted terms of service");
            return req.session.destroy((err?) => {
                return renderTemplate(res, "terms_of_service_not_accepted");
            });
        }

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
