import { Application } from "express";
import getRedisClient from "./redis";
import configureRedisSession from "./redis-session";
import configureHandlebars from "./handlebars";
import configureStatic from "./static";

export default (app: Application) => {
    // get redis client
    const redis = getRedisClient();

    // configure
    configureRedisSession(app, redis);
    configureHandlebars(app);
    configureStatic(app);
};
