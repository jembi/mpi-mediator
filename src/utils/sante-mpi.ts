import { getConfig } from '../config/config';
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
