import { expect } from 'chai';
import nock from 'nock';

import { getConfig } from '../../src/config/config';
import { mpiAuthMiddleware } from '../../src/middlewares/mpi-auth';
import { mpiToken, getMpiAuthToken } from '../../src/utils/mpi';

const config = getConfig();

const { mpiProtocol, mpiHost, mpiPort } = config;

const mpiUrl = `${mpiProtocol}://${mpiHost}:${mpiPort}`;

const newOauth2TokenGenerated = {
  token_type: 'bearer',
  access_token: 'accessToken',
  refresh_token: 'refreshToken',
  expires_in: 3, // 3s
};

describe('Access proxy', (): void => {
  describe('*getMpiAuthToken', async (): Promise<void> => {
    it('should generate access token', async (): Promise<void> => {
      nock(mpiUrl).post('/auth/oauth2_token').reply(200, newOauth2TokenGenerated);

      const response = await getMpiAuthToken();

      expect(response.accessToken).to.equal(newOauth2TokenGenerated.access_token);
      // Should be saved in the memory
      expect(mpiToken?.accessToken).to.equal(newOauth2TokenGenerated.access_token);
      nock.cleanAll();
    });

    it('should get saved access token', async (): Promise<void> => {
      nock(mpiUrl).post('/auth/oauth2_token').reply(200, {});

      const response = await getMpiAuthToken();

      expect(response.accessToken).to.equal(newOauth2TokenGenerated.access_token);
      // Should be saved in the memory
      expect(mpiToken?.accessToken).to.equal(newOauth2TokenGenerated.access_token);
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

      const response = await getMpiAuthToken();

      expect(response.accessToken).to.equal(newOauth2TokenRefreshed.access_token);
      // Should be saved in the memory
      expect(mpiToken?.accessToken).to.equal(newOauth2TokenRefreshed.access_token);

      nock.cleanAll();
    });
  });

  describe('*mpiAuthMiddleware', (): void => {
    it('should build the header with bearer token', async (): Promise<void> => {
      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 3000));

      nock(mpiUrl).post('/auth/oauth2_token').reply(200, newOauth2TokenGenerated);

      const requestExample = {
        body: {},
        headers: {},
      };

      await mpiAuthMiddleware(requestExample as any, {} as any, () => {
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
        await mpiAuthMiddleware(requestExample as any, {} as any, () => {});
      } catch (err) {
        expect(err).to.not.be.undefined;
      }
    });
  });
});
