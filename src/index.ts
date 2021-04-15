// env
import readEnvironment from "./environment";
const env = (function () {
    try {
        return readEnvironment();
    } catch (err) {
        console.log(`CONFIGURATION ERROR !! ${err.message}`);
        process.exit(1);
    }
})();

import express from "express";
import { config as dotenv_config } from "dotenv";
import configureRoutes from "./routes";
import configureMiddleware from "./middleware";

// create and configure app
const app = express();
configureMiddleware(app);
configureRoutes(app);

// listen
app.listen(env.http.port);
