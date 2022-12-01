import express from 'express';
import asyncHandler from 'express-async-handler';
import { fhirDatastoreAccessProxyMiddleware } from '../middlewares/fhir-datastore-access-proxy';
import { mpiAccessProxyMiddleware } from '../middlewares/mpi-access-proxy';
import { mpiAuthMiddleware } from '../middlewares/mpi-auth';
import { mpiMdmEverythingMiddleware } from '../middlewares/mpi-mdm-everything';
import { matchAsyncHandler } from './handlers/matchPatientAsync';
import { matchSyncHandler } from './handlers/matchPatientSync';

import { validate } from './handlers/validation';

const routes = express.Router();

const jsonBodyParser = express.json({ type: 'application/fhir+json' });

routes.post(
  '/fhir/validate',
  jsonBodyParser,
  asyncHandler(async (req, res) => {
    const { status, body } = await validate(req.body);

    res.set('Content-Type', 'application/openhim+json');
    res.status(status).send(body);
  })
);

routes.post('/fhir/Patient/\\$match', mpiAuthMiddleware, mpiAccessProxyMiddleware);

routes.get(
  '/fhir/Patient/:patientId/\\$everything',
  mpiMdmEverythingMiddleware,
  fhirDatastoreAccessProxyMiddleware
);

routes.post(
  '/fhir',
  jsonBodyParser,
  asyncHandler(async (req, res) => {
    res.set('Content-Type', 'application/openhim+json');

    const result = await matchSyncHandler(req.body);

    res.status(result.status).send(result.body);
  })
);

routes.post(
  '/async/fhir',
  jsonBodyParser,
  asyncHandler(async (req, res) => {
    res.set('Content-Type', 'application/openhim+json');

    const result = await matchAsyncHandler(req.body);

    res.status(result.status).send(result.body);
  })
);

export default routes;
