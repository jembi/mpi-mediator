import { expect } from 'chai';
import { Request, Response } from 'express';
import { Bundle, Observation, Patient } from 'fhir/r2';
import nock from 'nock';

import { getConfig } from '../../src/config/config';
import { santeMpiMdmQueryLinksMiddleware } from '../../src/middlewares/sante-mpi-mdm-query-links';
import { santeMpiMdmEverythingMiddleware } from '../../src/middlewares/sante-mpi-mdm-everything';
import { santeMpiAuthMiddleware } from '../../src/middlewares/sante-mpi-auth';

const config = getConfig();

const { santeMpiProtocol, santeMpiHost, santeMpiPort } = config;
const mpiUrl = `${santeMpiProtocol}://${santeMpiHost}:${santeMpiPort}`;

const { fhirDatastoreProtocol, fhirDatastoreHost, fhirDatastorePort } = config;
const fhirDatastoreUrl = `${fhirDatastoreProtocol}://${fhirDatastoreHost}:${fhirDatastorePort}`;

const newOauth2TokenGenerated = {
  token_type: 'bearer',
  access_token: 'accessToken',
  refresh_token: 'refreshToken',
  expires_in: 3, // 3s
};

const patientFhirResource1: Patient = {
  resourceType: 'Patient',
  id: '1',
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

const fhirObservation1: Observation = {
  resourceType: 'Observation',
  id: 'observation-1',
  status: 'final',
  code: {
    coding: [
      {
        system: 'http://loinc.org',
        code: '55233-1',
      },
    ],
  },
};

const fhirObservation2: Observation = {
  ...fhirObservation1,
  id: 'observation-2',
};

const fhirBundle1: Bundle = {
  resourceType: 'Bundle',
  id: 'bundle-example-1',
  meta: {
    lastUpdated: '2014-08-18T01:43:30Z',
  },
  type: 'searchset',
  total: 1,
  entry: [
    {
      resource: fhirObservation1,
    },
  ],
};

const fhirBundle2: Bundle = {
  ...fhirBundle1,
  id: 'bundle-example-2',
  entry: [
    {
      resource: fhirObservation2,
    },
  ],
};

describe('Middlewares', (): void => {
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
  
  describe('*santeMpiMdmQueryLinksMiddleware', (): void => {
    it('should forward request when mdm param is not supplied', async () => {
      const request = {
        body: {},
        headers: {},
        query: { subject: 'Patient/1' },
      } as any as Request;
      await santeMpiMdmQueryLinksMiddleware(request, {} as any, () => {});
      expect(request.query).to.deep.equal({ subject: 'Patient/1' });
    });

    it('should perform MDM expansion when mdm param is supplied', async () => {
      nock(mpiUrl).post('/auth/oauth2_token').reply(200, {});
      nock(mpiUrl).get('/fhir/Patient/1').reply(200, patientFhirResource1);
      nock(mpiUrl).get('/fhir/Patient/2').reply(200, patientFhirResource2);
      const request = {
        body: {},
        headers: {},
        query: { 'subject:mdm': 'Patient/1' },
      } as any as Request;
      const response = {
        send: function () {
          return this;
        },
        status: function () {
          return this;
        },
      } as any as Response;
      await santeMpiMdmQueryLinksMiddleware(request, response, () => {});
      expect(request.query).to.deep.equal({ subject: 'Patient/1,Patient/2' });
      nock.cleanAll();
    });
  });

  describe('*santeMpiMdmEverythingMiddleware', (): void => {
    it('should forward request when mdm param is not supplied', async () => {
      const request = {
        body: {},
        headers: {},
        query: {},
      } as any as Request;
      await santeMpiMdmEverythingMiddleware(request, {} as any, () => {});
      expect(request.query).to.deep.equal({});
    });

    it('should perform MDM expansion when mdm param is supplied', async () => {
      nock(fhirDatastoreUrl)
        .get('/fhir/Patient/1/$everything')
        .reply(200, fhirBundle1);
      nock(fhirDatastoreUrl)
        .get('/fhir/Patient/2/$everything')
        .reply(200, fhirBundle2);

      nock(mpiUrl).post('/auth/oauth2_token').reply(200, {});
      nock(mpiUrl).get('/fhir/Patient/1').reply(200, patientFhirResource1);
      nock(mpiUrl).get('/fhir/Patient/2').reply(200, patientFhirResource2);
      const request = {
        body: {},
        headers: {},
        query: { _mdm: 'true' },
        params: { patientId: '1' },
      } as any as Request;
      let result: any = null;
      let statusCode: number = 0;
      const response = {
        send: function (body: any) {
          result = body;
        },
        status: function (code: number) {
          statusCode = code;
          return this;
        },
        set: () => {},
      } as any as Response;
      await santeMpiMdmEverythingMiddleware(request, response, () => {});
      expect(statusCode).to.equal(200);
      expect(result.status).to.equal('200');
      expect(result.response.body.total).to.equal(2);
      expect(result.response.body.entry.length).to.equal(2);
      nock.cleanAll();
    });
  });
});
