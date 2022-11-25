import { RequestHandler } from 'express';
import { Bundle } from 'fhir/r2';
import logger from '../logger';
import { buildOpenhimResponseObject } from '../routes/utils';
import { MpiMediatorResponseObject } from '../types/response';
import { fetchAllPatientResourcesFromFhirDatastore } from '../utils/fhir-datastore';
import { fetchMpiPatientLinks } from '../utils/mpi';

/**
 * Get all patient related resources ($everything) from HAPI FHIR using MDM Expansion
 */
 const fetchAllLinkedPatientResources = async (patientId: string): Promise<MpiMediatorResponseObject> => {
  try {
    const patientRef = `Patient/${patientId}`
    const patientRefs: string[] = [];
    // Fetch all linked patients refs from the MPI
    await fetchMpiPatientLinks(patientRef, patientRefs);
    // Perform requests to HAPI FHIR to get everything for each patient ref
    const fhirRequests = patientRefs.map(fetchAllPatientResourcesFromFhirDatastore);
    const fhirBundles = (await Promise.all(fhirRequests)).filter((bundle) => !!bundle) as Bundle[];
    // Combine all bundles into a single one
    const bundle = fhirBundles.reduce((acc, curr) => {
      if (Array.isArray(curr.entry)) {
        acc.entry = (acc.entry || []).concat(curr.entry || []);
        acc.total = (acc.total || 0) + curr.entry.length;
      }
      return acc;
    }, {
      resourceType: 'Bundle',
      meta: {
        // @TODO : Update this using the new format lib
        lastUpdated: (new Date()).toISOString(),
      },
      type: 'searchset',
      total: 0,
      entry: []
    } as Bundle);

    return {
      status: 200,
      body: buildOpenhimResponseObject('200', 200, bundle),
    }
  } catch (e) {
    logger.error('Unable to fetch all linked patient resources (MDM expansion)', e);
    return {
      status: 500,
      body: buildOpenhimResponseObject('500', 500, e as Error)
    }
  }
}

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
  res.set('Content-Type', 'application/openhim+json');
  res.status(status).send(body);
};
