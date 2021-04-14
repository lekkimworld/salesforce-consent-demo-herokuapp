import { createClient as createRedisClient } from "redis";
import { URL } from "url";
import { promisify } from "util";

const CONNECTION_TIMEOUT = process.env.REDIS_CONNECTION_TIMEOUT
    ? Number.parseInt(process.env.REDIS_CONNECTION_TIMEOUT)
    : 20000;

const client = (function () {
    const redis_uri = process.env.REDIS_TLS_URL
        ? new URL(process.env.REDIS_TLS_URL as string)
        : process.env.REDIS_URL
        ? new URL(process.env.REDIS_URL as string)
        : undefined;
    if (
        process.env.REDIS_URL &&
        redis_uri &&
        redis_uri.protocol!.indexOf("rediss") === 0
    ) {
        return createRedisClient({
            port: Number.parseInt(redis_uri.port!),
            host: redis_uri.hostname!,
            password: redis_uri.password,
            db: 0,
            tls: {
                rejectUnauthorized: false,
                requestCert: true,
                agent: false,
            },
            connect_timeout: CONNECTION_TIMEOUT,
        });
    } else {
        return createRedisClient({
            url: process.env.REDIS_URL as string,
            connect_timeout: CONNECTION_TIMEOUT,
        });
    }
})();

const promisifiedClient = {
    get: promisify(client.get).bind(client),
    set: promisify(client.set).bind(client),
    setex: promisify(client.setex).bind(client),
    keys: promisify(client.keys).bind(client),
    mget: promisify(client.mget).bind(client),
    expire: promisify(client.expire).bind(client),
    del: promisify(client.del).bind(client),
};

export const getRedisClient = () => {
    return client;
};
export const getPromisifiedRedisClient = () => {
    return client;
};
export default getPromisifiedRedisClient;
