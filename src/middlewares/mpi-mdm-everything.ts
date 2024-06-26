import { RequestHandler } from 'express';
import logger from '../logger';
import { buildOpenhimResponseObject } from '../utils/utils';
import { MpiMediatorResponseObject, Orchestration } from '../types/response';
import { fetchMpiPatientLinks } from '../utils/mpi';
import { fetchAllPatientResourcesByRefs } from '../routes/handlers/fetchPatientResources';

/**
 * Get all patient related resources ($everything) from HAPI FHIR using MDM Expansion
 */
const fetchAllLinkedPatientResources = async (
  patientId: string
): Promise<MpiMediatorResponseObject> => {
  const orchestrations: Orchestration[] = [];

  try {
    const patientRef = `Patient/${patientId}`;
    const patientRefs: string[] = [];

    // Fetch all linked patients refs from the MPI
    await fetchMpiPatientLinks(patientRef, patientRefs);

    // Perform requests to HAPI FHIR to get everything for each patient ref
    const bundle = await fetchAllPatientResourcesByRefs(patientRefs, orchestrations);

    return {
      status: 200,
      body: buildOpenhimResponseObject('Successful', 200, bundle, 'application/fhir+json', orchestrations),
    };
  } catch (e) {
    logger.error('Unable to fetch all linked patient resources (MDM expansion)', e);

    return {
      status: 500,
      body: buildOpenhimResponseObject('Failed', 500, e as Error, 'application/fhir+json', orchestrations),
    };
  }
};

/**
 * Express middleware in order to perform MDM expansion on $everything requests operation using the MPI
 *
 * Let's say you have the following MDM links in the MPI where both Patient/1 and Patient/2 are MDM-matched
 * to the same golden resource (Patient/3) :
 *  Patient/1 --> Patient/3
 *  Patient/2 --> Patient/3
 *
 * Where performing the following request :
 *  >> GET http://example.com:3000/Patient/1/$everything?_mdm=true
 * Would combine the results of the following requests in a single bundle :
 *  >> GET http://example.com:3447/Patient/1/$everything
 *  >> GET http://example.com:3447/Patient/2/$everything
 *  >> GET http://example.com:3447/Patient/3/$everything
 */
export const mpiMdmEverythingMiddleware: RequestHandler = async (req, res, next) => {
  const isMdmEnabled = req.query._mdm === 'true';

  if (!isMdmEnabled) {
    logger.info(
      `${req.method} ${req.path} request to the MPI MDM Middleware - No MDM expansion taking place`
    );

    // No MDM expansion, we forward request as it is directly to FHIR Datastore
    return next();
  }

  // MDM expansion requested
  logger.info(
    `${req.method} ${req.path} request to the MPI MDM Middleware - MDM expanding $everything operation`
  );

  const { status, body } = await fetchAllLinkedPatientResources(req.params.patientId);

  res.set('Content-Type', 'application/json+openhim');
  res.status(status).send(body);
};
