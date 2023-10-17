// env
import readEnvironment, {printableEnvironment} from "./environment";
const env = (function () {
    try {
        return readEnvironment();
    } catch (err:any) {
        console.log(`CONFIGURATION ERROR !! ${err.message}`);
        process.exit(1);
    }
})();
console.log("Read environment", printableEnvironment());

import express from "express";
import configureRoutes from "./routes";
import configureMiddleware from "./middleware";

// create and configure app
const app = express();
configureMiddleware(app);
configureRoutes(app);

// listen
app.listen(env.http.port);
console.log(`Listening on port ${env.http.port}`);
