import { Application, NextFunction, Request, Response } from "express";
import {getRedisClient} from "./redis";
import configureRedisSession from "./redis-session";
import {json} from "body-parser";
import cookieParser from "cookie-parser";
import configureHandlebars from "./handlebars";
import configureStatic from "./static";
import { AuthenticatedUser, HttpException } from "./types";
import {v4 as uuid} from "uuid";
import readEnvironment from "./environment";
import { isTermsOfServiceAccepted, readConsentFromSalesforce, updateUserTerms } from "./routes_consent";
import renderTemplate from "./ui_helper";

const env = readEnvironment();

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

declare global {
    namespace Express {
        interface Locals {
            telemetryId: string | undefined;
            user: AuthenticatedUser | undefined;
        }
    }
}

export default (app: Application) => {
    app.disable("x-powered-by");

    // get redis client
    const redis = getRedisClient();

    // configure
    app.use(json());
    app.use(cookieParser())
    configureRedisSession(app, redis);
    configureHandlebars(app);
    configureStatic(app);

    // add middleware to set telemetry cookie if not set
    app.use((req: Request, res: Response, next: NextFunction) => {
        if (env.ui.cookieConsentDisable) return next();
        
        let telemetryId : string|undefined = req.cookies.telemetryId;
        if (!telemetryId) {
            telemetryId = uuid();
            console.log(`Client does not have a telemetryId cookie - setting it to <${telemetryId}>`);
            req.cookies = res.cookie("telemetryId", telemetryId);
        }

        // save in request
        res.locals.telemetryId = telemetryId;

        // continue
        next();
    })

    // add middleware to set user in res.locals and (re)load consent from 
    // Salesforce as required.
    app.use(async (req, res, next) => {
        // set user in res.locals
        res.locals.user =
            req.session && req.session.user ? req.session.user : undefined;
            
        // abort if oidc routes
        if (
            req.path.startsWith("/oidc") ||
            req.path.startsWith("/consent/accept") ||
            req.path.startsWith("/consent/decline")
        ) {
            return next();
        }

        // if we do have a user ensure we've read the terms from Salesforce
        if (res.locals.user) {
            const user = res.locals.user!;
            const outdated =
                !user.terms ||
                Math.floor((Date.now() - user.terms.lastUpdate) / 1000) >
                    env.consent.forceReloadInterval
                    ? true
                    : false;
            if (!user.terms || outdated) {
                const terms = await readConsentFromSalesforce(user);

                // we have the terms - update user
                updateUserTerms(user, terms);
            }

            if (
                user.terms &&
                (undefined === user.terms.order ||
                    undefined === user.terms.newsletter)
            ) {
                // we do not have specific values for terms when loaded from
                // Salesforce so ask user to specify
                return renderTemplate(res, "consent");
            }

            // Potentially the user may have revoked terms of service consent
            // so we need to check for it explicitly
            if (!isTermsOfServiceAccepted(user)) {
                console.log(
                    "User has not accepted terms of service or telemetry"
                );
                return renderTemplate(res, "terms_of_service_not_accepted");
            }
        }

        // all is okay - forward to application
        next();
    });

    // add middleware to convert HttpException
    app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
        if (err instanceof HttpException) {
            const ex = err as HttpException;
            return res
                .type(ex.type)
                .status(ex.statusCode)
                .send(new ErrorObject(ex.message, ex.error));
        } else {
            return res.status(500).send(new ErrorObject(err.message, err));
        }
    });
}
