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

routes.post(
  '/fhir/validate',
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

routes.post('/fhir', asyncHandler(async (req, res) => {
  res.set('Content-Type', 'application/openhim+json');

  const result = await matchSyncHandler(req.body);

  res.status(result.status).send(result.body);
}));

routes.post('/async/fhir', asyncHandler(async (req, res) => {
  res.set('Content-Type', 'application/openhim+json');

  const result = await matchAsyncHandler(req.body);

  res.status(result.status).send(result.body);
}));

export default routes;
