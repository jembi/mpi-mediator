import { Patient, Resource } from 'fhir/r2';
import { getConfig } from '../config/config';
import { getData } from '../routes/utils';
import { ClientOAuth2, OAuth2Token } from './client-oauth2';

// Singleton instance of SanteMPI Token stored in memory
export let santeMpiToken: OAuth2Token | null = null;

/**
 * Returns an instance of SanteMPI token, it does renew the token when expired.
 */
export const getSanteMpiAuthToken = async (): Promise<OAuth2Token> => {
  const config = getConfig();
  const {
    santeMpiProtocol,
    santeMpiHost,
    santeMpiPort,
    santeMpiClientId,
    santeMpiClientSecret,
  } = config;
  if (!santeMpiToken) {
    const santeMpiApiUrl = new URL(
      `${santeMpiProtocol}://${santeMpiHost}:${santeMpiPort}`
    );
    const santeMpiAuth = new ClientOAuth2({
      clientId: santeMpiClientId,
      clientSecret: santeMpiClientSecret,
      accessTokenUri: `${santeMpiApiUrl}auth/oauth2_token`,
      scopes: ['*'],
    });

    santeMpiToken = await santeMpiAuth.getToken();
  } else if (santeMpiToken.expired()) {
    santeMpiToken = await santeMpiToken.refresh();
  }
  return santeMpiToken;
};

/**
 * Fetch resource by ref from Sante MPI
 * @param {String} ref
 */
export const fetchResourceByRefFromSanteMpi = async <T extends Resource>(
  ref: string
): Promise<T | undefined> => {
  const config = getConfig();
  const {
    santeMpiProtocol: protocol,
    santeMpiHost: host,
    santeMpiPort: port,
  } = config;
  const token = await getSanteMpiAuthToken();
  const response = await getData(protocol, host, port, `fhir/${ref}`, {
    Authorization: `Bearer ${token.accessToken}`,
    'Content-Type': 'application/fhir+json',
  });
  return response.status === 200 ? (response.body as T) : undefined;
};

/**
 * Recusively fetch linked patient refs from Sante MPI
 * @param {String} patientRef
 * @param {String} patientLinks
 */
export const fetchSanteMpiPatientLinks = async (
  patientRef: string,
  patientLinks: string[]
) => {
  patientLinks.push(patientRef);
  const patient = await fetchResourceByRefFromSanteMpi<Patient>(patientRef);
  if (patient?.link) {
    const linkedRefs = patient.link.map(({ other }) => other.reference);
    const refsToFetch = linkedRefs.filter((ref) => {
      return ref && !patientLinks.includes(ref);
    }) as string[];
    if (refsToFetch.length > 0) {
      const promises = refsToFetch.map((ref) =>
        fetchSanteMpiPatientLinks(ref, patientLinks)
      );
      await Promise.all(promises);
    }
  }
};
