import { Application, NextFunction, Request, Response } from "express";
import getRedisClient from "./redis";
import configureRedisSession from "./redis-session";
import configureHandlebars from "./handlebars";
import configureStatic from "./static";
import { HttpException } from "./types";

class ErrorObject {
    error = true;
    readonly message: string;

    constructor(msg: string, err?: Error) {
        if (err) {
            this.message = `${msg} (${err.message})`;
        } else {
            this.message = msg;
        }
    }
}

export default (app: Application) => {
    app.disable("x-powered-by");

    // get redis client
    const redis = getRedisClient();

    // configure
    configureRedisSession(app, redis);
    configureHandlebars(app);
    configureStatic(app);

    // add middleware to convert HttpException
    app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
        if (err instanceof HttpException) {
            const ex = err as HttpException;
            return res
                .type(ex.type)
                .status(ex.statusCode)
                .send(new ErrorObject(ex.message, ex.error));
        } else {
            return res.status(500).send(new ErrorObject(err.message, err));
        }
        next();
    });
};
