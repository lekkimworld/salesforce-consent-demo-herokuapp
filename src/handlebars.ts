import { Application } from "express";
import Handlebars from "handlebars";
import exphbs from "express-handlebars";
import readEnvironment from "./environment";
import { AuthenticatedUser } from "./types";

const env = readEnvironment();

export default (app: Application) => {
    // add handlebars
    app.engine("handlebars", exphbs({ defaultLayout: "main" }));
    app.set("view engine", "handlebars");

    Handlebars.registerHelper({
        eq: function (v1, v2) {
            return v1 === v2;
        },
        ne: function (v1, v2) {
            return v1 !== v2;
        },
        lt: function (v1, v2) {
            return v1 < v2;
        },
        gt: function (v1, v2) {
            return v1 > v2;
        },
        lte: function (v1, v2) {
            return v1 <= v2;
        },
        gte: function (v1, v2) {
            return v1 >= v2;
        },
        and: function () {
            return Array.prototype.slice.call(arguments).every(Boolean);
        },
        or: function () {
            return Array.prototype.slice.call(arguments, 0, -1).some(Boolean);
        },
    });
};

export const buildContext = (user: AuthenticatedUser | undefined) => {
    let ctx: any = {
        salesforce: {
            // url to Salesforce
            experienceCloudUrl: env.oidc.providerUrl,
        },
        // user object
        user,
        // page title
        PAGE_TITLE: env.ui.pageTitle,
        // indicates if cookie consent (i.e. we're asking the user) is enabled or not
        cookieConsent: !env.ui.cookieConsentDisable,
    };
    if (env.datacloud && env.datacloud.webSdkUrl) {
        ctx.datacloud = {};
        ctx.datacloud.webSdkUrl = env.datacloud.webSdkUrl;      // url to the Data Cloud web sdk script
    }
    return ctx;
};
