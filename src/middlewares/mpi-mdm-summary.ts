import { RequestHandler } from 'express';
import logger from '../logger';
import { fetchMpiPatientLinks } from '../utils/mpi';
import { buildOpenhimResponseObject } from '../utils/utils';
import { fetchAllPatientSummariesByRefs } from '../routes/handlers/fetchPatientSummaries';

const fetchAllLinkedPatientSummary = async (patientId: string) => {
  try {
    const patientRef = `Patient/${patientId}`;
    const patientRefs: string[] = [];

    await fetchMpiPatientLinks(patientRef, patientRefs);

    const bundle = await fetchAllPatientSummariesByRefs(patientRefs);

    logger.debug(`Fetched all patient summaries from the MPI: ${bundle}`);

    return {
      status: 200,
      body: buildOpenhimResponseObject('Success', 200, bundle),
    };
  } catch (e) {
    logger.error('Unable to fetch all linked patient resources (MDM expansion)', e);

    return {
      status: 500,
      body: buildOpenhimResponseObject('Failed', 500, e as Error),
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

  res.set('Content-Type', 'application/openhim+json');
  res.status(status).send(body);
};
