import { Patient, Resource } from 'fhir/r2';
import { getConfig } from '../config/config';
import { getData } from '../routes/utils';
import { ClientOAuth2, OAuth2Token } from './client-oauth2';

// Singleton instance of MPI Token stored in memory
export let mpiToken: OAuth2Token | null = null;

/**
 * Returns an instance of MPI token, it does renew the token when expired.
 */
export const getMpiAuthToken = async (): Promise<OAuth2Token> => {
  const config = getConfig();
  const {
    mpiProtocol,
    mpiHost,
    mpiPort,
    mpiClientId,
    mpiClientSecret,
  } = config;
  if (!mpiToken) {
    const mpiApiUrl = new URL(
      `${mpiProtocol}://${mpiHost}:${mpiPort}`
    );
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
 export const fetchResourceByRefFromMpi = async <T extends Resource>(
  ref: string
): Promise<T | undefined> => {
  const config = getConfig();
  const {
    mpiProtocol: protocol,
    mpiHost: host,
    mpiPort: port,
  } = config;
  const token = await getMpiAuthToken();
  const response = await getData(protocol, host, port, `fhir/${ref}`, {
    Authorization: `Bearer ${token.accessToken}`,
    'Content-Type': 'application/fhir+json',
  });
  return response.status === 200 ? (response.body as T) : undefined;
};

/**
 * Recusively fetch linked patient refs from the MPI
 */
export const fetchMpiPatientLinks = async (
  patientRef: string,
  patientLinks: string[]
) => {
  patientLinks.push(patientRef);
  const patient = await fetchResourceByRefFromMpi<Patient>(patientRef);
  if (patient?.link) {
    const linkedRefs = patient.link.map(({ other }) => other.reference);
    const refsToFetch = linkedRefs.filter((ref) => {
      return ref && !patientLinks.includes(ref);
    }) as string[];
    if (refsToFetch.length > 0) {
      const promises = refsToFetch.map((ref) =>
        fetchMpiPatientLinks(ref, patientLinks)
      );
      await Promise.all(promises);
    }
  }
};
