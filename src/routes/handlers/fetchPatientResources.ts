import { Bundle } from 'fhir/r3';
import { getConfig } from '../../config/config';
import logger from '../../logger';
import { MpiMediatorResponseObject } from '../../types/response';
import { PATIENT_RESOURCES } from '../../utils/constants';
import { buildOpenhimResponseObject, getData, unbundle } from '../../utils/utils';

const {
  fhirDatastoreProtocol: protocol,
  fhirDatastoreHost: host,
  fhirDatastorePort: port,
  resources,
} = getConfig();

export const fetchAllPatientResources = async (ref: string): Promise<Bundle> => {
  const patientRef = `http://santedb-mpi:8080/fhir/Patient/${ref}`;

  const bundles = resources.map(async (resource) => {
    const path = `/fhir/${resource}?${PATIENT_RESOURCES[resource]}=${encodeURIComponent(
      patientRef
    )}`;

    try {
      const response = await getData(protocol, host, port, path);

      return response.body as Bundle;
    } catch (e) {
      logger.error('Unable to fetch patient resource ', resource, patientRef);

      return null;
    }
  });

  return unbundle(await Promise.all(bundles));
};

export const fetchPatientResources = async (
  patientRef: string
): Promise<MpiMediatorResponseObject> => {
  logger.info('Fetching resources for Patient');

  const response = await fetchAllPatientResources(patientRef);

  let transactionStatus: string;
  let status = 200;

  if (response.entry) {
    logger.info('Successfully fetch resources!');
    transactionStatus = 'Success';
  } else {
    logger.error(`Error in fetching resources!`);
    transactionStatus = 'Failed';
    status = 404;
  }

  const responseBody = buildOpenhimResponseObject(transactionStatus, status, response);

  return {
    body: responseBody,
    status: status,
  };
};
