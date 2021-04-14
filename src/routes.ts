import { Application, Router } from "express";
import configureApiRoutes from "./routes_api";
import configureHealthRoutes from "./routes_health";
import { buildContext } from "./handlebars";

export default (app: Application) => {
    // configure api and health
    configureApiRoutes(app);
    configureHealthRoutes(app);

    app.get("/", async (_req, res) => {
        return res.render("root", Object.assign(buildContext(), {}));
    });

    app.get("/products", async (_req, res) => {
        return res.render("products", Object.assign(buildContext(), {}));
    });
};
