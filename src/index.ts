import express from "express";
import path from 'path';

import { getConfig } from './config/config';
import logger from './logger';
import routes from './routes';
import { mediatorSetup } from "./openhim/openhim";

const config = getConfig();
const app = express();

app.use(express.json({ type: 'application/fhir+json' }));

app.use('/', routes);

app.listen(config.port, () => {
  logger.info(`Server is running on port - ${config.port}`);

  if (config.registerMediator) {
    mediatorSetup(path.resolve(__dirname, './openhim/mediatorConfig.json'));
  }
});
