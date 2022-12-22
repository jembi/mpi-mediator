import express from 'express';
import asyncHandler from 'express-async-handler';
import { fhirDatastoreAccessProxyMiddleware } from '../middlewares/fhir-datastore-access-proxy';
import { mpiAccessProxyMiddleware } from '../middlewares/mpi-access-proxy';
import { mpiAuthMiddleware } from '../middlewares/mpi-auth';
import { mpiMdmEverythingMiddleware } from '../middlewares/mpi-mdm-everything';
import { matchAsyncHandler } from './handlers/matchPatientAsync';
import { matchSyncHandler } from './handlers/matchPatientSync';
import { mpiMdmQueryLinksMiddleware } from '../middlewares/mpi-mdm-query-links';
import { MpiMediatorResponseObject } from '../types/response';
import { validate } from '../middlewares/validation';
import { submitPatient } from '../utils/kafkaFhir';

const routes = express.Router();

const jsonBodyParser = express.json({ type: 'application/fhir+json' });

routes.post(
  '/fhir',
  jsonBodyParser,
  validate,
  asyncHandler(async (req, res) => {
    const result = await matchSyncHandler(req.body);

    res.set('Content-Type', 'application/openhim+json');
    res.status(result.status).send(result.body);
  })
);

routes.post('/fhir/validate', jsonBodyParser, validate);

routes.post(
  '/fhir/Patient',
  jsonBodyParser,
  validate,
  asyncHandler(async (req, res) => {
    const handlerResponse: MpiMediatorResponseObject = await submitPatient(req.body);

    res.set('Content-Type', 'application/openhim+json');
    res.status(handlerResponse.status).send(handlerResponse.body);
  })
);

routes.post('/fhir/Patient/\\$match', mpiAuthMiddleware, mpiAccessProxyMiddleware);

routes.get(
  '/fhir/Patient/:patientId/\\$everything',
  mpiMdmEverythingMiddleware,
  fhirDatastoreAccessProxyMiddleware
);

routes.post(
  '/async/fhir',
  jsonBodyParser,
  validate,
  asyncHandler(async (req, res) => {
    res.set('Content-Type', 'application/openhim+json');

    const result = await matchAsyncHandler(req.body);

    res.status(result.status).send(result.body);
  })
);

routes.get(
  /^\/fhir\/[A-z]+(\/.+)?$/,
  mpiMdmQueryLinksMiddleware,
  fhirDatastoreAccessProxyMiddleware
);

export default routes;
