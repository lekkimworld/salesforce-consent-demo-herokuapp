import express from "express";
import { config as dotenv_config } from "dotenv";
import configureRoutes from "./routes";
import configureMiddleware from "./middleware";

// read environment
dotenv_config();

// create and configure app
const app = express();
configureMiddleware(app);
configureRoutes(app);

// listen
app.listen(process.env.PORT || 8080);
