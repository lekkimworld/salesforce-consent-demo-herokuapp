import { Application, Router } from "express";

export default (app: Application) => {
    const r = Router();
    app.use("/api", r);
};
