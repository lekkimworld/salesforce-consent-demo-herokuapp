import { Application } from "express";
import Handlebars from "handlebars";
import exphbs from "express-handlebars";
import readEnvironment from "./environment";

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

export const buildContext = (user: any | undefined) => {
    return {
        user,
        PAGE_TITLE: env.ui.pageTitle,
    };
};
