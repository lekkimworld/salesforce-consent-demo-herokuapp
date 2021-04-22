import fetch from "node-fetch";
import jwtFactory from "jsonwebtoken";
import readEnvironment from "./environment";
import { discoverOidcData } from "./oidc";
import { Client, Issuer } from "openid-client";

const env = readEnvironment();

type QueryArgs = {
    [key: string]: string | number | boolean | Date | undefined;
};
type BodyArg = { [key: string]: any | undefined };
interface FetchArgs {
    path?: string;
    url?: string;
    forceRefresh: boolean;
    queryArgs?: QueryArgs;
}

interface GetArgs extends FetchArgs {}
interface PatchArgs extends FetchArgs {
    body?: BodyArg;
}

let instance_url: string;
let access_token: string;
const getAccessToken = async (force_refresh: boolean = false) => {
    // return cache
    if (access_token && !force_refresh) {
        return access_token;
    }

    // generate JWT and exchange for access_token
    console.log("Getting access_token from JWT");
    const oidcdata = await discoverOidcData();
    const jwt = await jwtFactory.sign({}, env.jwt.privateKey, {
        algorithm: "RS256",
        audience: env.oidc.providerUrl,
        issuer: env.jwt.clientId,
        subject: env.jwt.subject,
        expiresIn: 3 * 60,
    });

    const token_endpoint = oidcdata.metadata.token_endpoint;
    let resp = await fetch(token_endpoint!, {
        headers: {
            "content-type": "application/x-www-form-urlencoded",
        },
        method: "POST",
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    // get json and cache
    const token_data = await resp.json();
    if (token_data.error) {
        const msg = `Salesforce ERROR - ${token_data.error}: ${token_data.error_description}`;
        throw Error(msg);
    }
    instance_url = token_data.instance_url;
    access_token = token_data.access_token;
    return access_token;
};
const buildUrl = (args: FetchArgs): string => {
    let url = args.url ? args.url : `${instance_url}${args.path}`;
    if (!args.queryArgs) return url;
    Object.keys(args.queryArgs!).forEach((key, idx) => {
        const value = args.queryArgs![key];
        const sep = idx === 0 ? "?" : "&";
        if (value) {
            url += `${sep}${key}=${
                typeof value === "object"
                    ? (value as Date).toISOString()
                    : value
            }`;
        } else {
            url += `${sep}${key}`;
        }
    });
    return url;
};
const doGet = async (args: GetArgs): Promise<any> => {
    // get access_token
    const access_token = await getAccessToken(args.forceRefresh);

    // do request
    const url = buildUrl(args);
    const resp = await fetch(url, {
        method: "GET",
        headers: {
            "content-type": "application/json",
            accepts: "application/json",
            authorization: `Bearer ${access_token}`,
        },
    });
    if (resp.status === 401) {
        return doGet(Object.assign({}, args, { forceRefresh: true }));
    }
    const result = await resp.json();
    return result;
};
const doPatch = async (args: PatchArgs): Promise<any> => {
    // get access_token
    const access_token = await getAccessToken(args.forceRefresh);

    // do request
    const url = buildUrl(args);
    const resp = await fetch(url, {
        method: "PATCH",
        headers: {
            "content-type": "application/json",
            accepts: "application/json",
            authorization: `Bearer ${access_token}`,
        },
        body: args.body ? JSON.stringify(args.body) : "",
    });
    if (resp.status === 401) {
        return doPatch(Object.assign({}, args, { forceRefresh: true }));
    }
    const result = await resp.json();
    return result;
};
export const getSalesforceUrl = async (url: string) => {
    return doGet({
        url: url,
        forceRefresh: false,
    });
};
export const getSalesforcePath = async (path: string, args?: QueryArgs) => {
    return doGet({
        path,
        forceRefresh: false,
        queryArgs: args,
    });
};
export const patchSalesforcePath = async (
    path: string,
    args?: QueryArgs,
    body?: BodyArg
) => {
    return doPatch({
        path,
        forceRefresh: false,
        queryArgs: args,
        body: body,
    });
};
const buildSalesforceDataServicePath = (path: string) => {
    let norm_path = path;
    if (path.indexOf("/") !== 0) {
        norm_path = `/${path}`;
    }
    const usepath = `/services/data/${env.api_version}${norm_path}`;
    return usepath;
};
export const getSalesforceDataService = async (
    path: string,
    args?: QueryArgs
) => {
    const usepath = buildSalesforceDataServicePath(path);
    return getSalesforcePath(usepath, args);
};
export const patchSalesforceDataService = async (
    path: string,
    args?: QueryArgs,
    body?: BodyArg
) => {
    const usepath = buildSalesforceDataServicePath(path);
    return patchSalesforcePath(usepath, args, body);
};
