import { expect } from 'chai';
import { Patient } from 'fhir/r2';
import nock from 'nock';

import { getConfig } from '../../src/config/config';
import {
  mpiToken,
  getMpiAuthToken,
  fetchMpiResourceByRef,
  fetchMpiPatientLinks,
} from '../../src/utils/mpi';

const config = getConfig();

const { mpiProtocol, mpiHost, mpiPort } = config;

const mpiUrl = `${mpiProtocol}://${mpiHost}:${mpiPort}`;

const newOauth2TokenGenerated = {
  token_type: 'bearer',
  access_token: 'accessToken',
  refresh_token: 'refreshToken',
  expires_in: 3, // 3s
};

const patientFhirResource1: Patient = {
  resourceType: 'Patient',
  id: '1',
  name: [
    {
      use: 'official',
      given: ['Peter', 'James'],
    },
    {
      use: 'usual',
      given: ['Jim'],
    },
    {
      use: 'maiden',
      given: ['Peter', 'James'],
      period: {
        end: '2002',
      },
    },
  ],
  gender: 'male',
  birthDate: '1974-12-25',
  managingOrganization: {
    reference: 'Organization/1',
  },
  link: [
    {
      other: {
        reference: 'Patient/2',
      },
      type: 'refer',
    },
  ],
};

const patientFhirResource2: Patient = {
  ...patientFhirResource1,
  id: '2',
  link: [
    {
      other: {
        reference: 'Patient/1',
      },
      type: 'seealso',
    },
  ],
};

describe('MPI', (): void => {
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

  describe('*fetchMpiResourceByRef', async (): Promise<void> => {
    it('should return undefined when we get a 404 from MPI', async (): Promise<void> => {
      nock(mpiUrl).get('/fhir/Patient/1').reply(404);
      const patient = await fetchMpiResourceByRef(`Patient/1`);
      expect(patient).to.equal(undefined);
      nock.cleanAll();
    });
    it('should fetch a MPI fhir resource by ref', async (): Promise<void> => {
      nock(mpiUrl).get('/fhir/Patient/1').reply(200, patientFhirResource1);
      const patient = await fetchMpiResourceByRef(`Patient/1`);
      expect(patient).to.deep.equal(patientFhirResource1);
      nock.cleanAll();
    });
  });

  describe('*fetchMpiPatientLinks', async (): Promise<void> => {
    it('should fetch patient links from MPI fhir', async (): Promise<void> => {
      nock(mpiUrl).get('/fhir/Patient/1').reply(200, patientFhirResource1);
      nock(mpiUrl).get('/fhir/Patient/2').reply(200, patientFhirResource2);
      const refs: string[] = [];
      await fetchMpiPatientLinks(`Patient/1`, refs);
      expect(refs).to.deep.equal(['Patient/1', 'Patient/2']);
      nock.cleanAll();
    });
  });
});
