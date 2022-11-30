import { getConfig } from '../config/config';
import { ClientOAuth2, OAuth2Token } from './client-oauth2';

// Singleton instance of MPI Token stored in memory
export let mpiToken: OAuth2Token | null = null;

/**
 * Returns an instance of MPI token, it does renew the token when expired.
 */
export const getMpiAuthToken = async (): Promise<OAuth2Token> => {
  const config = getConfig();
  const { mpiProtocol, mpiHost, mpiPort, mpiClientId, mpiClientSecret } = config;

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
