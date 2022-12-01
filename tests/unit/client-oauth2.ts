import { expect } from 'chai';
import nock from 'nock';

import { ClientOAuth2, OAuth2Error, OAuth2Token } from '../../src/utils/client-oauth2';

const protocol: string = 'http';
const host: string = 'example';
const port: number = 3000;
const path: string = 'auth/oauth2_token';

const clientData = {
  clientId: '',
  clientSecret: 'secret',
  accessTokenUri: `${protocol}://${host}:${port}/${path}`,
  scopes: [],
};

describe('Client Oauth2', (): void => {
  describe('*expiresIn ', (): void => {
    it('should return an expiration date when passing a number', async (): Promise<void> => {
      const client = new ClientOAuth2({
        clientId: 'string',
        clientSecret: 'string',
        accessTokenUri: 'string',
        scopes: [],
      });
      const oauth2 = new OAuth2Token(client, {});
      const expiresOn = 3;
      const dateNow = new Date();
      const expires = oauth2.expiresIn(expiresOn);
      expect(+expires - +dateNow).to.equal(expiresOn * 1000);
    });

    it('should return an expiration date when passing a date', async (): Promise<void> => {
      const client = new ClientOAuth2({
        clientId: 'string',
        clientSecret: 'string',
        accessTokenUri: 'string',
        scopes: [],
      });
      const oauth2 = new OAuth2Token(client, {});
      const expirationDate = new Date('2022-11-22');
      const expires = oauth2.expiresIn(expirationDate);
      expect(expires).to.deep.equal(expirationDate);
    });
  });

  describe('*refresh', (): void => {
    it('should return a request object with header', async (): Promise<void> => {
      const client = new ClientOAuth2(clientData);

      const oauth2 = new OAuth2Token(client, {
        token_type: 'bearer',
        access_token: 'accessToken',
        refresh_token: 'refreshToken',
        expires_in: '3',
      });

      const newOauth2TokenRefreshed = {
        access_token: 'accessToken2',
        refresh_token: 'refreshToken2',
        expires_in: '5',
      };

      nock(`http://${host}:${port}`).post(`/${path}`).reply(200, newOauth2TokenRefreshed);

      const response = await oauth2.refresh();

      expect(response.accessToken).to.equal(newOauth2TokenRefreshed.access_token);
      expect(response.refreshToken).to.equal(newOauth2TokenRefreshed.refresh_token);
    });

    it('should throw an error if no refresh token exist', async (): Promise<void> => {
      const client = new ClientOAuth2(clientData);

      const oauth2 = new OAuth2Token(client, {
        token_type: 'bearer',
        access_token: 'accessToken',
        expires_in: '3',
      });

      try {
        await oauth2.refresh();
      } catch (err) {
        console.log(err);
        expect(err).to.match(/No refresh token*/);
      }
    });
  });

  describe('*getToken', (): void => {
    it('should return an access token successfully', async (): Promise<void> => {
      const client = new ClientOAuth2(clientData);

      const newOauth2TokenGenerated = {
        token_type: 'bearer',
        access_token: 'accessToken',
        refresh_token: 'refreshToken',
        expires_in: '3',
      };

      nock(`http://${host}:${port}`).post(`/${path}`).reply(200, newOauth2TokenGenerated);

      const response = await client.getToken();
      expect(response.accessToken).to.equal(newOauth2TokenGenerated.access_token);
      expect(response.refreshToken).to.equal(newOauth2TokenGenerated.refresh_token);
    });
  });

  describe('*request', (): void => {
    it('should request and return data successfully', async (): Promise<void> => {
      const client = new ClientOAuth2(clientData);

      const data = {
        test: 'success',
      };

      nock(`http://${host}:${port}`).post(`/${path}`).reply(200, data);

      const response = await client.request({
        url: clientData.accessTokenUri,
        body: {
          client_id: clientData.clientId,
          client_secret: clientData.clientSecret,
        },
        query: {},
        headers: {},
        method: 'POST',
      });

      expect(response).to.deep.equal(data);
    });

    it('should request and throw authentication error', async (): Promise<void> => {
      const client = new ClientOAuth2(clientData);

      const data = {
        test: 'failure',
      };

      nock(`http://${host}:${port}`).post(`/${path}`).reply(403, data);

      try {
        await client.request({
          url: clientData.accessTokenUri,
          body: {
            client_id: clientData.clientId,
            client_secret: clientData.clientSecret,
          },
          query: {},
          headers: {},
          method: 'POST',
        });
      } catch (err: any) {
        expect(err.status as OAuth2Error).to.equal(403);
        expect(err.code as OAuth2Error).to.equal('ESTATUS');
      }
    });
  });
});
