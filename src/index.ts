import express from "express";
import path from 'path';

import { getConfig, REGISTER_MEDIATOR } from './config/config';
import logger from './logger';
import routes from './routes';
import { mediatorSetup } from "./openhim/openhim";

const port = getConfig().port;
const app = express();

app.use(express.json({ type: 'application/fhir+json' }));

app.use('/', routes);

app.listen(port, () => {
  logger.info(`Server is running on port - ${port}`);

  if (REGISTER_MEDIATOR) {
    mediatorSetup(path.resolve(__dirname, './openhim/mediatorConfig.json'));
  }
});
