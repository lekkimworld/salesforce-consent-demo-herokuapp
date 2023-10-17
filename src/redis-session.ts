import session from "express-session";
import connectRedis from "connect-redis";
import { Application } from "express";
import { RedisClient } from "redis";
import readEnvironment from "./environment";
import { AuthenticatedUser } from "./types";

const env = readEnvironment();

declare module "express-session" {
    export interface SessionData {
        oidc_nonce: string | undefined;
        user: AuthenticatedUser;
        consent: "optin"|"optout"|"none"
    }
}

export default (app: Application, redisClient: RedisClient) => {
    // configure session
    const RedisStore = connectRedis(session);
    if (env.production) {
        app.set("trust proxy", 1);
    }
    app.use(
        session({
            store: new RedisStore({
                client: redisClient,
            }),
            saveUninitialized: true,
            resave: false,
            secret: env.http.sessionSecret,
            cookie: env.production
                ? {
                      sameSite: true,
                      secure: true,
                  }
                : undefined,
        })
    );
};
