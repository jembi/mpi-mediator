import { Bundle } from 'fhir/r3';
import format from 'date-fns/format';

import { getConfig } from '../../config/config';
import {
  buildOpenhimResponseObject,
  createFhirDatastoreOrcherstation,
  getData,
  isHttpStatusOk,
  mergeBundles,
} from '../../utils/utils';
import logger from '../../logger';
import { MpiMediatorResponseObject, Orchestration } from '../../types/response';
import { fetchPatientById } from './fetchPatient';

const {
  fhirDatastoreProtocol: protocol,
  fhirDatastoreHost: host,
  fhirDatastorePort: port,
} = getConfig();

export const fetchAllPatientSummariesByRefs = async (
  patientRefs: string[],
  queryParams?: object,
  orchestrations: Orchestration[] = []
): Promise<Bundle> => {
  // remove duplicates
  patientRefs = Array.from(new Set(patientRefs.map(ref => ref?.split('/').pop() || '')));

  const patientExternalRefs = patientRefs.map(async (ref) => {
    const params = Object.entries(queryParams ?? {});
    let combinedParams = null;

    if (params.length > 0) {
      combinedParams = params
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&');
    }

    const fullPatient: MpiMediatorResponseObject = await fetchPatientById(ref, '');
    orchestrations.push(...fullPatient.body.orchestrations);

    if (!isHttpStatusOk(fullPatient.status) && fullPatient.status != 404) {
      throw fullPatient;
    }

    const path = `/fhir/Patient/${ref}/$summary${combinedParams ? `?${combinedParams}` : ''}`;

    const headers: HeadersInit = {'Content-Type': 'application/fhir+json'};

    const orchestration: Orchestration = createFhirDatastoreOrcherstation('Get summary', path);
  
    return getData(protocol, host, port, path, {
      'Content-Type': 'application/fhir+json',
    }).then((response) => {
      orchestration.response = {
        status: response.status,
        body: JSON.stringify(response.body),
        timestamp: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSXXX"),
        headers
      };
      orchestrations.push(orchestration);

      if (!isHttpStatusOk(response.status) && response.status != 404) {
        // We throw an error if one of the requests fails ( except for cases where a patient link does not exist in the datastore)
        throw response;
      }

      // Add patient's demographic data
      const bundle = response?.body as Bundle;

      const index = bundle.entry?.findIndex(resource => resource.resource?.resourceType?.match(/Patient/));

      if (bundle.entry && index && index > -1) {
        bundle.entry[index].resource = JSON.parse(fullPatient.body.response.body);
      }

      return {status: response.status, body: bundle};
    });
  });

  const bundles = (await Promise.all(patientExternalRefs))
    .filter((res) => isHttpStatusOk(res.status))
    .map((response) => response?.body as Bundle);

  logger.debug(`Fetched all patient summaries from the MPI: ${bundles}`);

  return mergeBundles(bundles, 'document');
};

export const fetchPatientSummaryByRef = async (
  ref: string,
  queryParams: object
): Promise<MpiMediatorResponseObject> => {
  const orchestrations: Orchestration[] = [];

  try {
    const bundle = await fetchAllPatientSummariesByRefs([ref], queryParams, orchestrations);
    const responseBody = buildOpenhimResponseObject('Successful', 200, bundle, 'application/fhir+json', orchestrations);

    logger.info(`Successfully fetched patient summary with id ${ref}`);

    return {
      status: 200,
      body: responseBody,
    };
  } catch (err) {
    logger.error(`Unable to fetch patient resources for id ${ref}`, err);

    const status = (err as any).status || 500;
    const body = (err as any).body || {};

    return {
      body: buildOpenhimResponseObject('Failed', status, body, 'application/fhir+json', orchestrations),
      status: status,
    };
  }
};
