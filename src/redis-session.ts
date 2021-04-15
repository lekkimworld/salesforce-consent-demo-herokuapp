import session from "express-session";
import connectRedis from "connect-redis";
import { Application } from "express";
import { RedisClient } from "redis";
import readEnvironment from "./environment";
import { AuthenticatedUser } from "./oidc";

const env = readEnvironment();

declare module "express-session" {
    export interface SessionData {
        oidc_nonce: string | undefined;
        user: AuthenticatedUser;
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
            saveUninitialized: false,
            resave: false,
            secret: env.http.sessionSecret,
            cookie: env.production
                ? {
                      sameSite: "none",
                      secure: true,
                  }
                : undefined,
        })
    );
};
