import fetch from "node-fetch";
import jwtFactory from "jsonwebtoken";
import readEnvironment from "./environment";
import { discoverOidcData } from "./oidc";
import { Client, Issuer } from "openid-client";

const env = readEnvironment();

interface GetArgs {
    path?: string;
    url?: string;
    forceRefresh: boolean;
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
    instance_url = token_data.instance_url;
    access_token = token_data.access_token;
    return access_token;
};
const doGet = async (args: GetArgs): Promise<any> => {
    // get access_token
    const access_token = await getAccessToken(args.forceRefresh);

    // do request
    const resp = await fetch(
        args.url ? args.url : `${instance_url}${args.path}`,
        {
            headers: {
                "content-type": "application/json",
                accepts: "application/json",
                authorization: `Bearer ${access_token}`,
            },
        }
    );
    if (resp.status === 401) {
        return doGet(Object.assign({}, args, { forceRefresh: true }));
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
export const getSalesforcePath = async (path: string) => {
    return doGet({
        path,
        forceRefresh: false,
    });
};
export const getSalesforceDataService = async (path: string) => {
    let norm_path = path;
    if (path.indexOf("/") !== 0) {
        norm_path = `/${path}`;
    }
    const usepath = `/services/data/${env.api_version}${norm_path}`;
    return getSalesforcePath(usepath);
};
