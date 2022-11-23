import express from 'express';
import asyncHandler from 'express-async-handler';
import { santeMpiAccessProxyMiddleware } from '../middlewares/sante-mpi-access-proxy';
import { santeMpiAuthMiddleware } from '../middlewares/sante-mpi-auth';

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

export default routes;
