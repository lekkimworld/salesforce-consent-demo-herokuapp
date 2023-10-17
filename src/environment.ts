import { config as dotenv_config } from "dotenv";
import { URL } from "url";
import { v4 as uuid } from "uuid";

dotenv_config();

const getBooleanEnvironmentValue = (name: string, defaultValue: boolean) => {
    if (!Object.prototype.hasOwnProperty.call(process.env, name)) return defaultValue;
    const v = process.env[name];
    if (!v || !v.length) return defaultValue;
    return v === "1" || v.substring(0,1).toLowerCase() === "t";
}

type SalesforceClientCredentials = {
    clientId: string;
    clientSecret: string;
    myDomain: string;
};
type Consent = {
    forceReloadInterval : number;
};
type SalesforceDataCloud = {
    webSdkUrl: string;
    engagementEventName: string;
};
interface OIDC {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    providerUrl: string;
    scopes: string;
    prompt: string;
}
type Redis = {
    connectionTimeout: number;
    host: string;
    port: number;
    password: string;
    secure: boolean;
}
type UI = {
    pageTitle: string;
    cookieConsentDisable: boolean;
};
type HttpServer = {
    port: number;
    sessionSecret: string;
}
type Environment = {
    api_version : string;
    terms_purpose : string;
    production : boolean;
    consent: Consent;
    ui : UI;
    http : HttpServer;
    redis : Redis;
    oidc : OIDC;
    salesforce : SalesforceClientCredentials;
    datacloud: SalesforceDataCloud;
}

export const readEnvironment = () : Environment => {
    const env = {} as Environment;
    env.api_version = process.env.API_VERSION || "v59.0";
    env.terms_purpose = process.env.TERMS_PURPOSE || "App Telemetry"
    env.production = process.env.NODE_ENV === "production";

    env.consent = {} as Consent;
    env.consent.forceReloadInterval = process.env.CONSENT_FORCE_RELOAD_INTERVAL
        ? Number.parseInt(process.env.CONSENT_FORCE_RELOAD_INTERVAL)
        : 300;
    
    env.ui = {} as UI;
    env.ui.pageTitle = process.env.PAGE_TITLE || "My App";
    env.ui.cookieConsentDisable = getBooleanEnvironmentValue("COOKIE_CONSENT_DISABLE", false);

    env.http = {} as HttpServer;
    env.http.port = process.env.PORT ? Number.parseInt(process.env.PORT) : 8080;
    env.http.sessionSecret = process.env.SESSION_SECRET || uuid();

    env.salesforce = {} as SalesforceClientCredentials;
    env.salesforce.clientId = process.env.CLIENTCREDS_CLIENT_ID as string;
    env.salesforce.clientSecret = process.env.CLIENTCREDS_CLIENT_SECRET as string;
    env.salesforce.myDomain = process.env.CLIENTCREDS_MYDOMAIN as string;

    env.datacloud = {} as SalesforceDataCloud;
    env.datacloud.webSdkUrl = process.env.DATACLOUD_WEBSDK_URL as string;
    env.datacloud.engagementEventName =
        process.env.DATACLOUD_ENGAGEMENT_EVENT_NAME || "EngagementData";
    
    env.oidc = {} as OIDC;
    env.oidc.clientId = process.env.OIDC_CLIENT_ID as string;
    env.oidc.clientSecret = process.env.OIDC_CLIENT_SECRET as string;
    env.oidc.redirectUri = process.env.OIDC_REDIRECT_URI as string;
    env.oidc.scopes = process.env.OIDC_SCOPES || "openid email";
    env.oidc.prompt = Object.prototype.hasOwnProperty.call(
        process.env,
        "OIDC_PROMPT"
    )
        ? (process.env.OIDC_PROMPT as string)
        : "login";
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
    env.redis = {} as Redis;
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
export const printableEnvironment = () : Environment => {
    const eachRecursive = (obj: any) => {
        for (var k in obj) {
        if (typeof obj[k] == "object" && obj[k] !== null)
            eachRecursive(obj[k]);
        else
            if (["sessionSecret", "clientId", "clientSecret", "privateKey", "password"].includes(k)) {
                obj[k] = obj[k] && obj[k].length ? `${obj[k].substring(0, 5)}...` : obj[k];
            }
        }
    }
    const env = readEnvironment();
    eachRecursive(env);
    return env;
}
export default readEnvironment;
