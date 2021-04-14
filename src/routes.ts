import { Application, Router } from "express";
import configureApiRoutes from "./routes_api";
import configureHealthRoutes from "./routes_health";

export default (app: Application) => {
    configureApiRoutes(app);
    configureHealthRoutes(app);
};
