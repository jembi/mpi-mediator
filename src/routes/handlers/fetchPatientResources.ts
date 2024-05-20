import { Bundle } from 'fhir/r3';
import format from 'date-fns/format';

import { getConfig } from '../../config/config';
import logger from '../../logger';
import { MpiMediatorResponseObject, Orchestration } from '../../types/response';
import { PATIENT_RESOURCES } from '../../utils/constants';
import {
  buildOpenhimResponseObject,
  createFhirDatastoreOrcherstation,
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
  patientRefs: string[],
  orchestrations: Orchestration[] = []
): Promise<Bundle> => {
  const responsePromises = resources.map((resource) => {
    const path = `/fhir/${resource}?${PATIENT_RESOURCES[resource]}=${encodeURIComponent(
      patientRefs.join(',')
    )}`;
    const headers: HeadersInit = { 'Content-Type': 'application/fhir+json' };

    const orchestration: Orchestration = createFhirDatastoreOrcherstation('Get patient resouces', path);

    return getData(protocol, host, port, path, headers).then((response) => {
      orchestration.response = {
        status: response.status,
        body: JSON.stringify(response.body),
        timestamp: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSXXX"),
        headers,
      };
      orchestrations.push(orchestration);

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

  const orchestrations: Orchestration[] = [];

  try {
    const bundle = await fetchAllPatientResourcesByRefs([patientRef], orchestrations);
    const responseBody = buildOpenhimResponseObject(
      'Success',
      200,
      bundle,
      'application/fhir+json',
      orchestrations
    );

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
      body: buildOpenhimResponseObject(
        'Failed',
        status,
        body,
        'application/fhir+json',
        orchestrations
      ),
      status: status,
    };
  }
};
