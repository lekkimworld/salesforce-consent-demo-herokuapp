import { Application, Router } from "express";
import {v4 as uuid} from "uuid";
import {getPromisifiedRedisClient} from "./redis";

export default (app: Application) => {
    const r = Router();
    r.get("/", async (_req, res) => {
        // get redis status
        const redisClient = getPromisifiedRedisClient();
        const key = uuid();
        const value = uuid();
        await redisClient.setex(key, 5, value);
        const redisUp = value === (await redisClient.get(key));

        res.type("json");
        res.send({
            "redis": redisUp,
            status: "OK",
        });
    });
    app.use("/health", r);
};
