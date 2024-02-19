import { Patient, Resource } from 'fhir/r3';
import { getConfig } from '../config/config';
import { getData, isHttpStatusOk } from './utils';
import { ClientOAuth2, OAuth2Token } from './client-oauth2';

// Singleton instance of MPI Token stored in memory
export let mpiToken: OAuth2Token | null = null;

/**
 * Returns an instance of MPI token, it does renew the token when expired.
 */
export const getMpiAuthToken = async (): Promise<OAuth2Token> => {
  const { mpiProtocol, mpiHost, mpiPort, mpiClientId, mpiClientSecret } = getConfig();

  if (!mpiToken) {
    const mpiApiUrl = new URL(`${mpiProtocol}://${mpiHost}:${mpiPort}`);
    const mpiAuth = new ClientOAuth2({
      clientId: mpiClientId,
      clientSecret: mpiClientSecret,
      accessTokenUri: `${mpiApiUrl}auth/oauth2_token`,
      scopes: ['*'],
    });

    mpiToken = await mpiAuth.getToken();
  } else if (mpiToken.expired()) {
    mpiToken = await mpiToken.refresh();
  }

  return mpiToken;
};

/**
 * Fetch resource by ref from the MPI
 */
export const fetchMpiResourceByRef = async <T extends Resource>(
  ref: string
): Promise<T | undefined> => {
  const { mpiProtocol: protocol, mpiHost: host, mpiPort: port, mpiAuthEnabled } = getConfig();
  const headers: HeadersInit = {
    'Content-Type': 'application/fhir+json',
  };

  if (mpiAuthEnabled) {
    const token = await getMpiAuthToken();

    headers['Authorization'] = `Bearer ${token.accessToken}`;
  }

  // Search using golden Id or interaction Id
  let response = await getData(protocol, host, port, `/fhir/links/${ref}`, headers);

  if (!isHttpStatusOk(response.status)) {
    response = await getData(protocol, host, port, `/fhir/${ref}`, headers);
  }

  return isHttpStatusOk(response.status) ? (response.body as T) : undefined;
};

/**
 * Recursively fetch linked patient refs from the MPI
 */
export const fetchMpiPatientLinks = async (patientRef: string, patientLinks: string[]) => {
  patientLinks.push(patientRef);

  const patient = await fetchMpiResourceByRef<Patient>(patientRef);

  if (patient?.link) {
    const linkedRefs = patient.link.map(({ other }) => other.reference);
    const refsToFetch = linkedRefs.filter((ref) => {
      return ref && !patientLinks.includes(ref);
    }) as string[];

    if (refsToFetch.length > 0) {
      const promises = refsToFetch.map((ref) => fetchMpiPatientLinks(ref, patientLinks));

      await Promise.all(promises);
    }
  }
};
