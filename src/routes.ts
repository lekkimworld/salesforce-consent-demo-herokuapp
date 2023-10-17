import { Application, Router } from "express";
import configureApiRoutes from "./routes_api";
import configureHealthRoutes from "./routes_health";
import configureTelemetryRoutes from "./routes_telemetry";
import configureConsentRoutes from "./routes_consent";
import renderTemplate from "./ui_helper";
import configureOIDC from "./oidc";
import configureShop from "./routes_shop";
import { HttpException } from "./types";

export default (app: Application) => {
    // routes that doesn't necessarily require auth
    configureTelemetryRoutes(app);
    configureOIDC(app);
    configureShop(app);
    
    app.get("/", async (req, res) => {
        if (req.session && req.session.user) {
            renderTemplate(res, "auth_root");
        } else {
            renderTemplate(res, "unauth_root");
        }
    });

    // *******************************
    // REQUIRE USER TO BE AUTHENTICATED FROM HERE
    // *******************************
    app.use((_req, res, next) => {
        if (!res.locals.user) {
            // user not logged in
            throw new HttpException(
                401,
                "User not logged in but attempting to call route that required authentication"
            );
        }
        next();
    });
    configureHealthRoutes(app);
    configureConsentRoutes(app);
    configureApiRoutes(app);
};
