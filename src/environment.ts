import { config as dotenv_config } from "dotenv";
import { URL } from "url";
import { v4 as uuid } from "uuid";

dotenv_config();

interface JWT {
    clientId: string;
    privateKey: string;
    subject: string;
}
interface OIDC {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    providerUrl: string;
    scopes: string;
}
interface Redis {
    connectionTimeout: number;
    host: string;
    port: number;
    password: string;
    secure: boolean;
}
interface UI {
    pageTitle: string;
}
interface HttpServer {
    port: number;
    sessionSecret: string;
}
export class Environment {
    api_version = process.env.API_VERSION || "v51.0";
    terms_purpose = process.env.TERMS_PURPOSE || "App Telemetry";
    production = false;
    ui = {} as UI;
    http = {} as HttpServer;
    redis = {} as Redis;
    oidc = {} as OIDC;
    jwt = {} as JWT;

    constructor() {}
}

export const readEnvironment = () => {
    const env = new Environment();
    env.production = process.env.NODE_ENV === "production";
    env.ui.pageTitle = process.env.PAGE_TITLE || "My App";
    env.http.port = process.env.PORT ? Number.parseInt(process.env.PORT) : 8080;
    env.http.sessionSecret = process.env.SESSION_SECRET || uuid();

    env.jwt.clientId = process.env.JWT_CLIENT_ID as string;
    env.jwt.privateKey = process.env.JWT_PRIVATE_KEY as string;
    env.jwt.subject = process.env.JWT_SUBJECT as string;
    env.oidc.clientId = process.env.OIDC_CLIENT_ID as string;
    env.oidc.clientSecret = process.env.OIDC_CLIENT_SECRET as string;
    env.oidc.redirectUri = process.env.OIDC_REDIRECT_URI as string;
    env.oidc.scopes = process.env.OIDC_SCOPES || "openid email";
    env.oidc.providerUrl =
        (process.env.OIDC_PROVIDER_URL as string) ||
        "https://login.salesforce.com";

    // redis
    const redis_uri = process.env.REDIS_TLS_URL
        ? new URL(process.env.REDIS_TLS_URL as string)
        : process.env.REDIS_URL
        ? new URL(process.env.REDIS_URL as string)
        : undefined;
    if (!redis_uri) throw Error("Missing REDIS url info in environment");
    env.redis.secure =
        (redis_uri && redis_uri.protocol!.indexOf("rediss") === 0) || false;
    env.redis.host = redis_uri.hostname;
    env.redis.port = Number.parseInt(redis_uri.port);
    env.redis.password = redis_uri.password;
    env.redis.connectionTimeout = process.env.REDIS_CONNECTION_TIMEOUT
        ? Number.parseInt(process.env.REDIS_CONNECTION_TIMEOUT)
        : 20000;

    // validate
    if (!env.oidc.clientId || !env.oidc.clientSecret || !env.oidc.redirectUri) {
        throw Error("Missing value for required OIDC environment variable");
    }
    return env;
};
export default readEnvironment;
