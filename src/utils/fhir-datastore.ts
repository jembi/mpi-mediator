import { Bundle } from 'fhir/r2';
import { getConfig } from '../config/config';
import { getData } from '../routes/utils';

/**
 * Fetch all patient related resources ($everything operation)
 * @param {String} ref
 */
export const fetchAllPatientResourcesFromFhirDatastore = async (
  ref: string
): Promise<Bundle | undefined> => {
  const config = getConfig();
  const {
    fhirDatastoreProtocol: protocol,
    fhirDatastoreHost: host,
    fhirDatastorePort: port,
  } = config;
  const response = await getData(protocol, host, port, `fhir/${ref}`);
  return response.status === 200 ? (response.body as Bundle) : undefined;
};
