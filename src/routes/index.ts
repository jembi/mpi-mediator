import express from 'express';
import asyncHandler from 'express-async-handler';
import { fhirDatastoreAccessProxyMiddleware } from '../middlewares/fhir-datastore-access-proxy';
import { santeMpiAccessProxyMiddleware } from '../middlewares/sante-mpi-access-proxy';
import { santeMpiAuthMiddleware } from '../middlewares/sante-mpi-auth';
import { santeMpiMdmEverythingMiddleware } from '../middlewares/sante-mpi-mdm-everything';
import { santeMpiMdmQueryLinksMiddleware } from '../middlewares/sante-mpi-mdm-query-links';
import { validate } from './handlers/validation';

const routes = express.Router();

const jsonBodyParser = express.json({ type: 'application/fhir+json' });

routes.post('/fhir/validate', jsonBodyParser, asyncHandler(async (req, res) => {
  const { status, body } = await validate(req.body);
  res.set('Content-Type', 'application/openhim+json');
  res.status(status).send(body);
}));

routes.post(
  '/fhir/Patient/\\$match',
  santeMpiAuthMiddleware,
  santeMpiAccessProxyMiddleware,
);

routes.get('/fhir/Patient/:patientId/$everything', 
  santeMpiMdmEverythingMiddleware,
  fhirDatastoreAccessProxyMiddleware
);

routes.get(/^\/fhir\/[A-z]+(\/.+)?$/, 
  santeMpiMdmQueryLinksMiddleware,
  fhirDatastoreAccessProxyMiddleware
);

export default routes;
