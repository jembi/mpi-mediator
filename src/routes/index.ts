import express from 'express';
import asyncHandler from "express-async-handler";
import { matchAsyncHandler } from './handlers/matchPatientAsync';
import { matchSyncHandler } from './handlers/matchPatientSync';

import { validate } from './handlers/validation';

const routes = express.Router();

routes.post('/fhir/validate', asyncHandler(async (req, res) => {
  res.set('Content-Type', 'application/openhim+json');

  const result = await validate(req.body);

  res.status(result.status).send(result.body);
}));

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
