import { Application, Router } from "express";
import { HttpException, TermsData, AuthenticatedUser } from "./types";
import renderTemplate from "./ui_helper";
import {
    getSalesforceDataService,
    patchSalesforceDataService,
} from "./fetch_util";

export const updateUserTerms = (user: AuthenticatedUser, terms: TermsData) => {
    user.terms = new TermsData();
    console.log(
        `Setting terms - tos: ${terms.tos}, order: ${terms.order}, newsletter: ${terms.newsletter}`
    );
    user.terms.tos = terms.tos || false;
    user.terms.order = terms.order;
    user.terms.newsletter = terms.newsletter;
};
export const isTermsOfServiceAccepted = (user: AuthenticatedUser) => {
    return user.terms && user.terms.tos;
};
export const writeConsentToSalesforce = async (
    user: AuthenticatedUser,
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
        `Writing terms to Salesforce - order: ${order}, newsletter: ${newsletter}`
    );
    await writeConsent("Online Order", order);
    await writeConsent("Newsletter", newsletter);
    const terms = await readConsentFromSalesforce(user);
    updateUserTerms(user, terms);
};
export const readConsentFromSalesforce = async (
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
            const order = determineValue(tcdata.explanation, "Online Order");
            const newsletter = determineValue(tcdata.explanation, "Newsletter");

            const result = new TermsData();
            result.tos = tos;
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
        result.order = readConsentRecord(data.records, "Online Order");
        result.newsletter = readConsentRecord(data.records, "Newsletter");
        return result;
    }
};

export default (app: Application) => {
    const r = Router();

    r.get("/accept/*", async (req, res) => {
        const match_result = req.path.match(
            /\/accept\/(true|false)\/(true|false)\/?/
        );
        if (!match_result)
            throw new HttpException(
                417,
                "Invalid format for /terms/accept",
                undefined
            );

        // get consent elements
        const order = match_result[1] === "true";
        const newsletter = match_result[2] === "true";

        // write data to salesforce
        await writeConsentToSalesforce(req.session.user!, order, newsletter);

        // redirect back to app
        return res.redirect("/");
    })

    r.get("/declineall", async (req, res) => {
        // update
        await writeConsentToSalesforce(req.session.user!, false, false);

        // redirect back to app
        return res.redirect("/");
    })

    /**
     * Show options to change consent settings
     */
    r.get("/", async (_req, res) => {
        renderTemplate(res, "consent", {
            order: res.locals.user?.terms?.order, 
            newsletter: res.locals.user?.terms?.newsletter
        });
    });

    app.use("/consent", r);
};
