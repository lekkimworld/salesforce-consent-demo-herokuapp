import express from "express";
import { config as dotenv_config } from "dotenv";
import configureRoutes from "./routes";

dotenv_config();

const app = express();
configureRoutes(app);

app.listen(process.env.PORT || 8080);
