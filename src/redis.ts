import { createClient as createRedisClient, ClientOpts } from "redis";
import { promisify } from "util";
import readEnvironment from "./environment";

const env = readEnvironment();

const client = (function () {
    const base_config = {
        port: env.redis.port,
        host: env.redis.host,
        db: 0,
        connect_timeout: env.redis.connectionTimeout,
    } as ClientOpts;
    if (env.redis.password) base_config.password = env.redis.password;

    if (env.redis.secure) {
        base_config.tls = {
            rejectUnauthorized: false,
            requestCert: true,
            agent: false,
        };
    }

    return createRedisClient(base_config);
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
    return promisifiedClient;
};
export default getPromisifiedRedisClient;
