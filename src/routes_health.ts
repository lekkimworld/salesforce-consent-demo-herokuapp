import { Application, Router } from "express";

export default (app: Application) => {
    const r = Router();
    r.get("/", async (_req, res) => {
        res.type("json");
        res.send({
            status: "OK",
        });
    });
    app.use("/health", r);
};
