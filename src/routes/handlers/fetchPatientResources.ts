import { Bundle } from 'fhir/r3';
import { getConfig } from '../../config/config';
import logger from '../../logger';
import { MpiMediatorResponseObject } from '../../types/response';
import { PATIENT_RESOURCES } from '../../utils/constants';
import { buildOpenhimResponseObject, getData, mergeBundles } from '../../utils/utils';

const {
  fhirDatastoreProtocol: protocol,
  fhirDatastoreHost: host,
  fhirDatastorePort: port,
  mpiProtocol,
  mpiHost,
  mpiPort,
  resources,
} = getConfig();

export const fetchAllPatientResourcesByRefs = async (
  patientRefs: string[]
): Promise<Bundle> => {
  const patientExternalRefs = patientRefs.map(
    (ref) => `${mpiProtocol}://${mpiHost}:${mpiPort}/fhir/${ref}`
  );

  const responsePromises = resources.map((resource) => {
    const path = `/fhir/${resource}?${PATIENT_RESOURCES[resource]}=${encodeURIComponent(
      patientExternalRefs.join(',')
    )}`;

    return getData(protocol, host, port, path, {
      'Content-Type': 'application/fhir+json',
    }).catch((err) => {
      logger.error('Unable to fetch patient resource ', resource, patientRefs, err);

      return null;
    });
  });

  const bundles = (await Promise.all(responsePromises))
    .filter((response) => !!response)
    .map((response) => response?.body as Bundle);

  return mergeBundles(bundles);
};

export const fetchEverythingByRef = async (
  patientRef: string
): Promise<MpiMediatorResponseObject> => {
  logger.info('Fetching resources for Patient');

  const bundle = await fetchAllPatientResourcesByRefs([patientRef]);

  let transactionStatus: string;
  let status = 200;

  if (bundle.entry?.length !== 0) {
    logger.info(`Successfully fetched resources for patient with id ${patientRef}!`);
    transactionStatus = 'Success';
  } else {
    logger.error(`No resources associated to this patient!`);
    transactionStatus = 'Failed';
    status = 404;
  }

  const responseBody = buildOpenhimResponseObject(transactionStatus, status, bundle);

  return {
    body: responseBody,
    status: status,
  };
};
