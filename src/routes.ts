import { Application, Router } from "express";
import configureApiRoutes from "./routes_api";
import configureHealthRoutes from "./routes_health";
import renderTemplate from "./ui_helper";
import { ensureAuthenticated } from "./oidc";
import configureOIDC from "./oidc";

export default (app: Application) => {
    // always ensure authenticated
    ensureAuthenticated(app);
    configureOIDC(app);

    // configure api and health
    configureApiRoutes(app);
    configureHealthRoutes(app);

    app.get("/", async (_req, res) => {
        renderTemplate(res, "auth_root");
    });

    app.get("/terms", async (_req, res) => {
        renderTemplate(res, "terms");
    });

    app.get("/shop", async (_req, res) => {
        renderTemplate(res, "shop");
    });
};
