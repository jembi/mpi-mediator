import express from "express";

import { getConfig } from './config/config';
import logger from './logger';
import routes from './routes/index';
import { asyncPatientMatchHandler } from "./routes/kafkaAsyncPatientHandler";

const config = getConfig();
const port = config.port;

const app = express();

app.use(express.json({type: 'application/fhir+json'}));

app.use('/', routes);

if (config.runningMode !== 'testing') {
  app.listen(port, () => {
    logger.info(`Server is running on port - ${port}`);
    asyncPatientMatchHandler();
  });
}
