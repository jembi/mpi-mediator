import express from 'express';
import asyncHandler from 'express-async-handler';
import { fhirDatastoreAccessProxyMiddleware } from '../middlewares/fhir-datastore-access-proxy';
import { mpiAccessProxyMiddleware } from '../middlewares/mpi-access-proxy';
import { mpiAuthMiddleware } from '../middlewares/mpi-auth';
import { mpiMdmEverythingMiddleware } from '../middlewares/mpi-mdm-everything';
import { matchAsyncHandler } from './handlers/matchPatientAsync';
import { matchSyncHandler } from './handlers/matchPatientSync';
import { mpiMdmQueryLinksMiddleware } from '../middlewares/mpi-mdm-query-links';
import { validationMiddleware } from '../middlewares/validation';
import { buildOpenhimResponseObject } from '../utils/utils';
import { fetchEverythingByRef } from './handlers/fetchPatientResources';
import { mpiMdmSummaryMiddleware } from '../middlewares/mpi-mdm-summary';
import { fetchPatientSummaryByRef } from './handlers/fetchPatientSummaries';
import { getConfig } from '../config/config';
import logger from '../logger';
import {
  fetchPatientById,
  fetchPatientByQuery,
} from './handlers/fetchPatient';

const routes = express.Router();

const { bodySizeLimit } = getConfig();
const jsonBodyParser = express.json({ type: 'application/fhir+json', limit: bodySizeLimit });

routes.post(
  '/fhir',
  jsonBodyParser,
  validationMiddleware,
  asyncHandler(async (req, res) => {
    const result = await matchSyncHandler(req.body);

    res.set('Content-Type', 'application/json+openhim');
    res.status(result.status).send(result.body);
  })
);

routes.post(
  '/fhir/validate',
  jsonBodyParser,
  validationMiddleware,
  asyncHandler(async (_req, res) => {
    const { status, transactionStatus, body } = res.locals.validationResponse;

    const responseBody = buildOpenhimResponseObject(transactionStatus, status, body);

    res.set('Content-Type', 'application/json+openhim');
    res.status(status).send(responseBody);
  })
);

routes.post(
  '/fhir/Patient',
  jsonBodyParser,
  validationMiddleware,
  mpiAuthMiddleware,
  mpiAccessProxyMiddleware
);

routes.post(
  '/fhir/Patient/\\$match',
  jsonBodyParser,
  validationMiddleware,
  mpiAuthMiddleware,
  mpiAccessProxyMiddleware
);

// swap source ID for interaction ID
routes.get('/fhir/Patient/:patientId', async (req, res) => {
  const requestedId = req.params.patientId;

  logger.debug(`Fetching patient ${requestedId} from FHIR store`);

  const { status, body } = await fetchPatientById(requestedId, String(req.query?.projection));

  res.set('Content-Type', 'application/json+openhim');
  res.status(status).send(body);
});

routes.get('/fhir/Patient', async (req, res) => {
  logger.debug(`Fetching patient from Client registry using query params`);

  const { status, body } = await fetchPatientByQuery(req.query);

  res.set('Content-Type', 'application/json+openhim');
  res.status(status).send(body);
});

routes.get(
  '/fhir/Patient/:patientId/\\$everything',
  mpiMdmEverythingMiddleware,
  asyncHandler(async (req, res) => {
    const { status, body } = await fetchEverythingByRef(`Patient/${req.params.patientId}`);

    res.set('Content-Type', 'application/json+openhim');
    res.status(status).send(body);
  })
);

routes.get(
  '/fhir/Patient/:patientId/\\$summary',
  mpiMdmSummaryMiddleware,
  asyncHandler(async (req, res) => {
    const { status, body } = await fetchPatientSummaryByRef(
      `Patient/${req.params.patientId}`,
      req.query
    );

    res.set('Content-Type', 'application/json+openhim');
    res.status(status).send(body);
  })
);

routes.post(
  '/async/fhir',
  jsonBodyParser,
  validationMiddleware,
  asyncHandler(async (req, res) => {
    const result = await matchAsyncHandler(req.body);

    res.set('Content-Type', 'application/json+openhim');
    res.status(result.status).send(result.body);
  })
);

routes.get(
  /^\/fhir\/[A-z]+(\/.+)?$/,
  mpiMdmQueryLinksMiddleware,
  fhirDatastoreAccessProxyMiddleware
);

export default routes;
