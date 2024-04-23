import { RequestHandler } from 'express';
import logger from '../logger';
import { fetchMpiPatientLinks } from '../utils/mpi';
import { buildOpenhimResponseObject } from '../utils/utils';
import { fetchAllPatientSummariesByRefs } from '../routes/handlers/fetchPatientSummaries';
import { Orchestration } from '../types/response';

const fetchAllLinkedPatientSummary = async (patientId: string) => {
  const orchestrations: Orchestration[] = [];

  try {
    const patientRef = `Patient/${patientId}`;
    const patientRefs: string[] = [];

    await fetchMpiPatientLinks(patientRef, patientRefs);

    const bundle = await fetchAllPatientSummariesByRefs(patientRefs, orchestrations);

    logger.debug(`Fetched all patient summaries from the MPI: ${bundle}`);

    return {
      status: 200,
      body: buildOpenhimResponseObject('Success', 200, bundle, 'application/fhir+json', orchestrations),
    };
  } catch (e) {
    logger.error('Unable to fetch all linked patient resources (MDM expansion)', e);

    return {
      status: 500,
      body: buildOpenhimResponseObject('Failed', 500, e as Error, 'application/fhir+json', orchestrations),
    };
  }
};

export const mpiMdmSummaryMiddleware: RequestHandler = async (req, res, next) => {
  const isMdmEnabled = req.query._mdm === 'true';

  if (!isMdmEnabled) {
    logger.info(
      `${req.method} ${req.path} request to the MPI MDM Middleware - No MDM expansion taking place`
    );

    return next();
  }

  const { status, body } = await fetchAllLinkedPatientSummary(req.params.patientId);

  res.set('Content-Type', 'application/json+openhim');
  res.status(status).send(body);
};
