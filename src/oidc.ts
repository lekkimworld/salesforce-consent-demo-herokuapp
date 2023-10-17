import { Application, Router } from "express";
import { Issuer, generators, Client } from "openid-client";
import readEnvironment from "./environment";
import { AuthenticatedUser, AuthenticationUrlWithNonce, HttpException } from "./types";

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



export default (app: Application) => {
    // create a router
    const router = Router();

    /** 
     * Login
     */
    router.get("/login", async (req, res, next) => {
        // doesn't make sense if user is already logged in - error in the UI
        if (req.session.user) {
            throw new HttpException(417, "User is already logged in");
        }

        // user is attempting to login - get url and redirect
        const authurl = await getAuthenticationUrl();
        req.session.oidc_nonce = authurl.nonce;
        return res.redirect(authurl.url);
    })

    /**
     * Logout
     */
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
            console.log(
                "Performed OIDC callback and retrieved tokenset",
                JSON.stringify(tokenSet, undefined, 2)
            );

            // get userinfo
            const userinfo = await oidcClient.userinfo(tokenSet);
            console.log(
                "Requested OIDC UserInfo",
                JSON.stringify(userinfo, undefined, 2)
            );

            // ensure we have a row in LOGIN_USER for the user
            req.session.user = new AuthenticatedUser(userinfo);

            // redirect
            res.redirect("/");
        } catch (err: any) {
            return next(
                new HttpException(
                    417,
                    `Unable to perform callback (${err}`,
                    err as Error
                )
            );
        }
    });

    // add router for OIDC
    app.use("/oidc", router);
};
