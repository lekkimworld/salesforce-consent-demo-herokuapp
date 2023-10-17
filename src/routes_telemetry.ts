import { Application, Router } from "express";
import renderTemplate from "./ui_helper";
import readEnvironment from "./environment";

const env = readEnvironment();

export default (app: Application) => {
    const r = Router();
    r.get("/telemetry.js", async (req, res) => {
        res.type("javascript");
        renderTemplate(res, "telemetry-js", {
            layout: false,
            telemetryId: res.locals.telemetryId,
            engagementEventName: env.datacloud.engagementEventName
        });
    });
    app.use("/telemetry", r);
};
