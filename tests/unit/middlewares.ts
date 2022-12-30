import { expect } from 'chai';
import { Request, Response } from 'express';
import { Bundle, Observation, Patient } from 'fhir/r3';
import nock from 'nock';

import { getConfig } from '../../src/config/config';
import { mpiMdmEverythingMiddleware } from '../../src/middlewares/mpi-mdm-everything';
import { mpiMdmQueryLinksMiddleware } from '../../src/middlewares/mpi-mdm-query-links';
import { mpiAuthMiddleware } from '../../src/middlewares/mpi-auth';
import format from 'date-fns/format';

const config = getConfig();

const { mpiProtocol, mpiHost, mpiPort } = config;
const mpiUrl = `${mpiProtocol}://${mpiHost}:${mpiPort}`;

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

const fhirBundle1: Bundle = {
  resourceType: 'Bundle',
  id: 'bundle-example-1',
  meta: {
    lastUpdated: '2014-08-18T01:43:30Z',
  },
  type: 'searchset',
  total: 1,
  link: [{ relation: 'self', url: 'http://hapi-fhir/bundle-example-1' }],
  entry: [
    {
      resource: fhirObservation1,
    },
  ],
};

const Encounters: Bundle = {
  resourceType: 'Bundle',
  id: 'testBundle',
  type: 'searchset',
  total: 2,
  entry: [
    {
      fullUrl: 'Encounter/testEncounter',
      resource: {
        resourceType: 'Encounter',
        id: 'testEncounter',
        status: 'arrived',
        subject: {
          reference: 'http://sante-mpi:8080/fhir/Patient/1',
        },
      },
    },
    {
      fullUrl: 'Encounter/testEncounter',
      resource: {
        resourceType: 'Encounter',
        id: 'testEncounter',
        status: 'arrived',
        subject: {
          reference: 'http://sante-mpi:8080/fhir/Patient/2',
        },
      },
    },
  ],
};
const Observations: Bundle = {
  resourceType: 'Bundle',
  id: 'testBundle',
  type: 'searchset',
  total: 2,
  entry: [
    {
      fullUrl: 'Observation/testObservation',
      resource: {
        resourceType: 'Observation',
        id: 'testObservation',
        status: 'cancelled',
        subject: {
          reference: 'http://sante-mpi:8080/fhir/Patient/1',
        },
        code: {},
      },
    },
    {
      fullUrl: 'Observation/testObservation',
      resource: {
        resourceType: 'Observation',
        id: 'testObservation',
        status: 'cancelled',
        subject: {
          reference: 'http://sante-mpi:8080/fhir/Patient/2',
        },
        code: {},
      },
    },
  ],
};

const Appointments: Bundle = {
  resourceType: 'Bundle',
  id: 'testBundle',
  type: 'searchset',
  entry: [
    {
      fullUrl: 'Appointments/testEncounter',
      resource: {
        resourceType: 'Appointment',
        id: 'testEncounter',
        status: 'arrived',
        participant: [
          {
            status: 'accepted',
            actor: {
              reference: 'http://sante-mpi:8080/fhir/Patient/1',
            },
          },
        ],
      },
    },
    {
      fullUrl: 'Appointments/testEncounter',
      resource: {
        resourceType: 'Appointment',
        id: 'testEncounter',
        status: 'arrived',
        participant: [
          {
            status: 'accepted',
            actor: {
              reference: 'http://sante-mpi:8080/fhir/Patient/2',
            },
          },
        ],
      },
    },
  ],
};

describe('Middlewares', (): void => {
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

  describe('*mpiMdmEverythingMiddleware', (): void => {
    it('should forward request when mdm param is not supplied', async () => {
      const request = {
        body: {},
        headers: {},
        query: {},
      } as any as Request;
      await mpiMdmEverythingMiddleware(request, {} as any, () => {});
      expect(request.query).to.deep.equal({});
    });

    it('should perform MDM expansion when mdm param is supplied', async () => {
      nock(mpiUrl).post('/auth/oauth2_token').reply(200, newOauth2TokenGenerated);
      nock(mpiUrl).get('/fhir/Patient/1').reply(200, patientFhirResource1);
      nock(mpiUrl).get('/fhir/Patient/2').reply(200, patientFhirResource2);
      nock(fhirDatastoreUrl)
        .get(
          `/fhir/Encounter?subject=${encodeURIComponent(
            'http://santedb-mpi:8080/fhir/Patient/1,http://santedb-mpi:8080/fhir/Patient/2'
          )}`
        )
        .reply(200, Encounters);
      nock(fhirDatastoreUrl)
        .get(
          `/fhir/Appointment?patient=${encodeURIComponent(
            'http://santedb-mpi:8080/fhir/Patient/1,http://santedb-mpi:8080/fhir/Patient/2'
          )}`
        )
        .reply(200, Appointments);
      nock(fhirDatastoreUrl)
        .get(
          `/fhir/Observation?subject=${encodeURIComponent(
            'http://santedb-mpi:8080/fhir/Patient/1,http://santedb-mpi:8080/fhir/Patient/2'
          )}`
        )
        .reply(200, Observations);

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
      await mpiMdmEverythingMiddleware(request, response, () => {});
      expect(statusCode).to.equal(200);
      expect(result.status).to.equal('200');
      expect(result.response.body.total).to.equal(6);
      expect(result.response.body.entry.length).to.equal(6);
      nock.cleanAll();
    });
  });

  describe('*mpiMdmQueryLinksMiddleware', (): void => {
    it('should forward request when mdm param is not supplied', async () => {
      const request = {
        body: {},
        headers: {},
        query: { subject: 'Patient/1' },
      } as any as Request;
      await mpiMdmQueryLinksMiddleware(request, {} as any, () => {});
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
      await mpiMdmQueryLinksMiddleware(request, response, () => {});
      expect(request.query).to.deep.equal({ subject: 'Patient/1,Patient/2' });
      nock.cleanAll();
    });
  });
});
