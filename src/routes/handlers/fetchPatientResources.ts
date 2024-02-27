import { Bundle } from 'fhir/r3';
import { getConfig } from '../../config/config';
import logger from '../../logger';
import { MpiMediatorResponseObject } from '../../types/response';
import { PATIENT_RESOURCES } from '../../utils/constants';
import {
  buildOpenhimResponseObject,
  getData,
  isHttpStatusOk,
  mergeBundles,
} from '../../utils/utils';

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
  const responsePromises = resources.map((resource) => {
    const path = `/fhir/${resource}?${PATIENT_RESOURCES[resource]}=${encodeURIComponent(
      patientRefs.join(',')
    )}`;

    return getData(protocol, host, port, path, {
      'Content-Type': 'application/fhir+json',
    }).then((response) => {
      if (!isHttpStatusOk(response.status)) {
        // We throw an error if one of the requests fails
        throw response;
      }

      return response;
    });
  });

  const bundles = (await Promise.all(responsePromises)).map(
    (response) => response?.body as Bundle
  );

  return mergeBundles(bundles);
};

export const fetchEverythingByRef = async (
  patientRef: string
): Promise<MpiMediatorResponseObject> => {
  logger.info('Fetching resources for Patient');

  try {
    const bundle = await fetchAllPatientResourcesByRefs([patientRef]);
    const responseBody = buildOpenhimResponseObject('Success', 200, bundle);

    logger.info(`Successfully fetched resources for patient with id ${patientRef}!`);

    return {
      body: responseBody,
      status: 200,
    };
  } catch (err) {
    logger.error(`Unable to fetch all linked patient resources!`, err);

    const status = (err as any).status || 500;
    const body = (err as any).body || {};

    return {
      body: buildOpenhimResponseObject('Failed', status, body),
      status: status,
    };
  }
};
