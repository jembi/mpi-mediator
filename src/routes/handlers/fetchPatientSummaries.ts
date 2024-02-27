import { Bundle } from 'fhir/r3';
import { getConfig } from '../../config/config';
import {
  buildOpenhimResponseObject,
  getData,
  isHttpStatusOk,
  mergeBundles,
} from '../../utils/utils';
import logger from '../../logger';
import { MpiMediatorResponseObject } from '../../types/response';

const {
  fhirDatastoreProtocol: protocol,
  fhirDatastoreHost: host,
  fhirDatastorePort: port,
} = getConfig();

export const fetchAllPatientSummariesByRefs = async (
  patientRefs: string[]
): Promise<Bundle> => {
  const patientExternalRefs = patientRefs.map((ref) => {
    const path = `/fhir/${ref}/$summary`;

    return getData(protocol, host, port, path, {
      'Content-Type': 'application/fhir+json',
    }).then((response) => {
      if (!isHttpStatusOk(response.status) && response.status != 404) {
        // We throw an error if one of the requests fails ( except for cases where a patient link does not exist in the datastore)
        throw response;
      }

      return response;
    });
  });

  const bundles = (await Promise.all(patientExternalRefs))
    .filter((res) => isHttpStatusOk(res.status))
    .map((response) => response?.body as Bundle);

  logger.debug(`Fetched all patient summaries from the MPI: ${bundles}`);

  return mergeBundles(bundles, 'document');
};

export const fetchPatientSummaryByRef = async (
  ref: string
): Promise<MpiMediatorResponseObject> => {
  try {
    const bundle = await fetchAllPatientSummariesByRefs([ref]);
    const responseBody = buildOpenhimResponseObject('Successful', 200, bundle);

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
      body: buildOpenhimResponseObject('Failed', status, body),
      status: status,
    };
  }
};
