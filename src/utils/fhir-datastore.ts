import { Bundle } from 'fhir/r3';
import { getConfig } from '../config/config';
import { getData, isHttpStatusOk } from './utils';

/**
 * Fetch all patient related resources ($everything operation)
 */
export const fetchAllPatientResourcesFromFhirDatastore = async (
  ref: string
): Promise<Bundle | undefined> => {
  const {
    fhirDatastoreProtocol: protocol,
    fhirDatastoreHost: host,
    fhirDatastorePort: port,
  } = getConfig();
  const response = await getData(protocol, host, port, `/fhir/${ref}/$everything`);

  return isHttpStatusOk(response.status) ? (response.body as Bundle) : undefined;
};
