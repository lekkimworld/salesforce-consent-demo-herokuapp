import { Application, Router } from "express";
import { Issuer, generators, custom, Client } from "openid-client";
import readEnvironment from "./environment";
import { HttpException } from "./types";
import renderTemplate from "./ui_helper";
import fetch from "node-fetch";
import {
    getSalesforceDataService,
    patchSalesforceDataService,
} from "./fetch_util";

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
    tos?: boolean;
    telemetry?: boolean;
    order?: boolean;
    newsletter?: boolean;
}

export class AuthenticatedUser {
    fn: string;
    ln: string;
    fullname: string;
    userId: string;
    contactId: string;
    active: boolean;
    photo: string;
    userinfo: any;
    terms?: TermsData;

    constructor(userinfo: any) {
        this.fn = userinfo.given_name;
        this.ln = userinfo.family_name;
        this.fullname = userinfo.name;
        this.userId = userinfo.user_id;
        this.contactId = userinfo.custom_attributes.contactId;
        this.active = userinfo.active;
        this.photo = userinfo.photos.picture;
        this.userinfo = userinfo;
    }
}

const updateUserTerms = (user: AuthenticatedUser, terms: TermsData) => {
    if (!user.terms) user.terms = new TermsData();
    console.log(
        `Setting terms - tos: ${terms.tos}, telemetry: ${terms.telemetry}, order: ${terms.order}, newsletter: ${terms.newsletter}`
    );
    user.terms.tos = terms.tos || false;
    user.terms.telemetry = terms.telemetry || false;
    user.terms.order = terms.order || false;
    user.terms.newsletter = terms.newsletter || false;
};
const isTermsOfServiceAccepted = (user: AuthenticatedUser) => {
    return user.terms && user.terms.tos && user.terms.telemetry;
};
const writeConsentToSalesforce = async (
    user: AuthenticatedUser,
    telemetry: boolean,
    order: boolean,
    newsletter: boolean
) => {
    const writeConsent = async (name: string, optin: boolean) => {
        await patchSalesforceDataService("/consent/action/web", {
            ids: user.contactId,
            captureContactPoint: "Web",
            captureSource: "My Fitness Tracker Web App",
            purposeName: name,
            status: optin ? "OptIn" : "OptOut",
            effectiveFrom: new Date().toISOString(),
            consentName: `${name}, ${user.contactId}`,
            effectiveTo: new Date(
                Date.now() + 10 * 365 * 24 * 60 * 60 * 1000
            ).toISOString(),
        });
    };
    console.log(
        `Writing terms to Salesforce - telemetry: ${telemetry}, order: ${order}, newsletter: ${newsletter}`
    );
    await writeConsent("Telemetry", telemetry);
    await writeConsent("Online Order", order);
    await writeConsent("Newsletter", newsletter);
    const terms = await readConsentFromSalesforce(user);
    updateUserTerms(user, terms);
};
const readConsentFromSalesforce = async (
    user: AuthenticatedUser
): Promise<TermsData> => {
    const useConsentApi = false;
    if (useConsentApi) {
        const tc = await getSalesforceDataService("/consent/action/web", {
            ids: user.contactId,
            verbose: undefined,
        });
        console.log(
            `Read Salesforce Consent data via Consent API for contact: ${user.contactId}`
        );
        console.log(JSON.stringify(tc, undefined, 2));

        // grab the first response (error in Salesforce API response) and parse data
        const tcdata = tc[user.contactId];
        if (["Success", "NO_PURPOSE_MATCH"].includes(tcdata.result)) {
            // found user data - update terms object from Salesforce
            const determineValue = (
                records: any[],
                purpose: string
            ): boolean | undefined => {
                return records.reduce((prev: boolean, r: any) => {
                    if (prev !== undefined) return prev;
                    if (
                        r.objectConsulted === "ContactPointTypeConsent" &&
                        r.purpose === purpose
                    ) {
                        return r.value === "OPT_IN";
                    }
                }, undefined);
            };
            const tos = determineValue(tcdata.explanation, "Terms of Service");
            const telemetry = determineValue(tcdata.explanation, "Telemetry");
            const order = determineValue(tcdata.explanation, "Online Order");
            const newsletter = determineValue(tcdata.explanation, "Newsletter");

            const result = new TermsData();
            result.tos = tos;
            result.telemetry = telemetry;
            result.order = order;
            result.newsletter = newsletter;
            return result;
        } else {
            throw new HttpException(
                417,
                "Unable to read consent data for user from Salesforce",
                undefined
            );
        }
    } else {
        const userdata = await getSalesforceDataService("/query", {
            q: `SELECT IndividualId FROM Contact WHERE Id='${user.contactId}' LIMIT 1`,
        });
        const individualId = userdata.records[0].IndividualId;
        console.log(
            `Read IndividualId (${individualId}) for Contact (${user.contactId})`
        );
        const data = await getSalesforceDataService("/query", {
            q: `SELECT Id, Name, DataUsePurpose.Name, PrivacyConsentStatus FROM ContactPointTypeConsent WHERE PartyId='${individualId}'`,
        });
        console.log(
            `Read Salesforce Consent data via SOQL for Individual: ${individualId}`
        );
        console.log(JSON.stringify(data, undefined, 2));

        const readConsentRecord = (
            records: any[],
            purpose: string
        ): boolean | undefined => {
            if (!records || !Array.isArray(records)) return false;
            const record = records.find(
                (r: any) => r.DataUsePurpose.Name === purpose
            );
            if (record) return record.PrivacyConsentStatus === "OptIn";
            return undefined;
        };
        const result = new TermsData();
        result.tos = readConsentRecord(data.records, "Terms of Service");
        result.telemetry = readConsentRecord(data.records, "Telemetry");
        result.order = readConsentRecord(data.records, "Online Order");
        result.newsletter = readConsentRecord(data.records, "Newsletter");
        return result;
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
        if (req.path.startsWith("/oidc/logout")) return next();

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
        } else if (req.path === "/terms") {
            return next();
        }

        // if we do not have the terms yet - read from Salesforce
        if (!req.session.user.terms) {
            const terms = await readConsentFromSalesforce(req.session.user);
            if (
                undefined == terms.telemetry ||
                undefined === terms.order ||
                undefined === terms.newsletter
            ) {
                // we do not have terms in Salesforce for this user yet - send to terms page
                return renderTemplate(res, "terms");
            }

            // we have the terms - update user
            updateUserTerms(req.session.user, terms);
        }

        // ensure user accepted terms of service
        if (!isTermsOfServiceAccepted(req.session.user)) {
            console.log("User has not accepted terms of service or telemetry");
            return renderTemplate(res, "terms_of_service_not_accepted");
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
