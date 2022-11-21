import { expect } from 'chai';
import nock from 'nock';

import { getConfig } from '../../src/config/config';
import {
  santeMpiToken,
  getSanteMpiAuthToken,
  santeMpiAuthMiddleware,
} from '../../src/routes/handlers/access-proxy';

const config = getConfig();

const { santeMpiProtocol, santeMpiHost, santeMpiPort } = config;

const mpiUrl = `${santeMpiProtocol}://${santeMpiHost}:${santeMpiPort}`;

const newOauth2TokenGenerated = {
  token_type: 'bearer',
  access_token: 'accessToken',
  refresh_token: 'refreshToken',
  expires_in: 3, // 3s
};

describe('Access proxy', (): void => {
  describe('*getSanteMpiAuthToken', async (): Promise<void> => {
    it('should generate access token', async (): Promise<void> => {
      nock(mpiUrl)
        .post('/auth/oauth2_token')
        .reply(200, newOauth2TokenGenerated);

      const response = await getSanteMpiAuthToken();

      expect(response.accessToken).to.equal(
        newOauth2TokenGenerated.access_token
      );
      // Should be saved in the memory
      expect(santeMpiToken?.accessToken).to.equal(
        newOauth2TokenGenerated.access_token
      );
      nock.cleanAll();
    });

    it('should get saved access token', async (): Promise<void> => {
      nock(mpiUrl).post('/auth/oauth2_token').reply(200, {});

      const response = await getSanteMpiAuthToken();

      expect(response.accessToken).to.equal(
        newOauth2TokenGenerated.access_token
      );
      // Should be saved in the memory
      expect(santeMpiToken?.accessToken).to.equal(
        newOauth2TokenGenerated.access_token
      );
      nock.cleanAll();
    });

    it('should refresh expired access token', async (): Promise<void> => {
      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const newOauth2TokenRefreshed = {
        token_type: 'bearer',
        access_token: 'accessToken2',
        refresh_token: 'refreshToken2',
        expires_in: 1, // 1s
      };

      nock(mpiUrl)
        .post(
          '/auth/oauth2_token',
          `refresh_token=${newOauth2TokenGenerated.refresh_token}&grant_type=refresh_token&clientId=&client_secret=`
        )
        .reply(200, newOauth2TokenRefreshed);

      const response = await getSanteMpiAuthToken();

      expect(response.accessToken).to.equal(
        newOauth2TokenRefreshed.access_token
      );
      // Should be saved in the memory
      expect(santeMpiToken?.accessToken).to.equal(
        newOauth2TokenRefreshed.access_token
      );

      nock.cleanAll();
    });
  });

  describe('*santeMpiAuthMiddleware', (): void => {
    it('should build the header with bearer token', async (): Promise<void> => {
      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 3000));

      nock(mpiUrl)
        .post('/auth/oauth2_token')
        .reply(200, newOauth2TokenGenerated);

      const requestExample = {
        body: {},
        headers: {},
      };

      await santeMpiAuthMiddleware(requestExample as any, {} as any, () => {
        const req = requestExample as any;
        expect(req.headers.authorization).to.equal(
          `Bearer ${newOauth2TokenGenerated.access_token}`
        );
      });

      nock.cleanAll();
    });

    it('should fail if no token was found', async (): Promise<void> => {
      await new Promise((resolve) => setTimeout(resolve, 3000));

      nock(mpiUrl).post('/auth/oauth2_token').reply(400, {});

      const requestExample = {
        body: {},
        headers: {},
      };
      try {
        await santeMpiAuthMiddleware(
          requestExample as any,
          {} as any,
          () => {}
        );
      } catch (err) {
        expect(err).to.not.be.undefined;
      }
    });
  });
});
