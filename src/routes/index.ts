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
import { buildOpenhimResponseObject, getData } from '../utils/utils';
import { fetchEverythingByRef } from './handlers/fetchPatientResources';
import { mpiMdmSummaryMiddleware } from '../middlewares/mpi-mdm-summary';
import { fetchPatientSummaryByRef } from './handlers/fetchPatientSummaries';
import { getConfig } from '../config/config';
import { Patient } from 'fhir/r3';
import { getMpiAuthToken } from '../utils/mpi';
import logger from '../logger';

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

  const {
    fhirDatastoreProtocol: fhirProtocol,
    fhirDatastoreHost: fhirHost,
    fhirDatastorePort: fhirPort,
    mpiProtocol: mpiProtocol,
    mpiHost: mpiHost,
    mpiPort: mpiPort,
    mpiAuthEnabled,
  } = getConfig();
  const fhirResponse = await getData(
    fhirProtocol,
    fhirHost,
    fhirPort,
    `/fhir/Patient/${requestedId}`,
    {}
  );

  let upstreamId = requestedId;

  if (fhirResponse.status === 200) {
    const patient = fhirResponse.body as Patient;
    const interactionId =
      patient.link && patient.link[0]?.other.reference?.match(/Patient\/([^/]+)/)?.[1];

    if (interactionId) {
      upstreamId = interactionId;
      logger.debug(`Swapping source ID ${requestedId} for interaction ID ${upstreamId}`);
    }
  }

  logger.debug(`Fetching patient ${upsteamId} from MPI`);

  const headers: HeadersInit = {
    'Content-Type': 'application/fhir+json',
  };

  if (mpiAuthEnabled) {
    const token = await getMpiAuthToken();

    headers['Authorization'] = `Bearer ${token.accessToken}`;
  }

  const mpiResponse = await getData(
    mpiProtocol,
    mpiHost,
    mpiPort,
    `/fhir/links/Patient/${upsteamId}`,
    {}
  );

  // Map the upstreamId to the requestedId
  if (mpiResponse.status === 200) {
    const patient = mpiResponse.body as Patient;

    patient.id = requestedId;
    logger.debug(
      `Mapped upstream ID ${upsteamId} to requested ID ${requestedId} in response body`
    );
  }

  res.status(mpiResponse.status).send(mpiResponse.body);
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
    const { status, body } = await fetchPatientSummaryByRef(`Patient/${req.params.patientId}`);

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
