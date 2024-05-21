import { expect } from 'chai';
import { Request, Response } from 'express';
import { Bundle, Observation, Patient } from 'fhir/r3';
import nock from 'nock';

import { getConfig } from '../../src/config/config';
import { mpiMdmEverythingMiddleware } from '../../src/middlewares/mpi-mdm-everything';
import { mpiMdmQueryLinksMiddleware } from '../../src/middlewares/mpi-mdm-query-links';
import { validationMiddleware } from '../../src/middlewares/validation';
import { mpiAuthMiddleware } from '../../src/middlewares/mpi-auth';
import { mpiMdmSummaryMiddleware } from '../../src/middlewares/mpi-mdm-summary';
import { createNewPatientRef } from '../../src/utils/utils';

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
        reference: 'Patient/0x4',
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
        reference: 'Patient/0x7',
      },
      type: 'seealso',
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

const patientRefSummary1 = 'Patient/1';
const patientRefSummary2 = 'Patient/2';

const patientSummary1: Bundle = {
  resourceType: 'Bundle',
  id: 'testBundle',
  type: 'document',
  entry: [
    {
      fullUrl: 'urn:uuid:545e5dba-10a0-4070-b8d2-93bbc135ed9c',
      resource: {
        resourceType: 'Composition',
        status: 'final',
        type: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '60591-5',
              display: 'Patient Summary Document',
            },
          ],
        },
        subject: {
          reference: 'urn:uuid:99286c8f-3849-4e29-b9aa-c9a563e1a54c',
        },
        date: '2024-02-14T13:12:57.901+00:00',
        author: [
          {
            reference: 'urn:uuid:01fa1e49-bed8-4a09-8249-2f569343874e',
          },
        ],
        title: 'Patient Summary as of 02/14/2024',
        confidentiality: 'N',
      },
    },
  ],
};

const patientSummary2: Bundle = {
  resourceType: 'Bundle',
  id: 'testBundle',
  type: 'document',
  entry: [
    {
      fullUrl: 'urn:uuid:545e5dba-10a0-4070-b8d2-93bbc135ed9c',
      resource: {
        resourceType: 'Composition',
        status: 'final',
        type: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '60591-5',
              display: 'Patient Summary Document',
            },
          ],
        },
        subject: {
          reference: 'urn:uuid:99286c8f-3849-4e29-b9aa-c9a563e1a54c',
        },
        date: '2024-02-14T13:12:57.901+00:00',
        author: [
          {
            reference: 'urn:uuid:01fa1e49-bed8-4a09-8249-2f569343874e',
          },
        ],
        title: 'Patient Summary as of 02/14/2024',
        confidentiality: 'N',
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

  describe('*validationMiddleware', (): void => {
    it('should return error when content type is incorrect', async () => {
      const request = {
        body: { ...patientFhirResource1 },
        headers: {},
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

      await validationMiddleware(request, response, () => {});
      expect(statusCode).to.equal(400);
      nock.cleanAll();
    });

    it('should validate bundle and forward it to SanteMPI', async () => {
      nock(fhirDatastoreUrl)
        .post('/fhir/Patient/$validate')
        .reply(200, {
          status: 'Successful',
          body: { ...patientFhirResource1 },
        });

      const request = {
        body: { ...patientFhirResource1 },
        headers: {
          'content-type': config.contentType,
        },
      } as any as Request;
      const response = {
        locals: {},
        send: function (body: any) {
          this.locals.validationResponse.body = body;
        },
        status: function (code: number) {
          this.locals.validationResponse.status = code;
          return this;
        },
        set: () => {},
      } as any as Response;

      await validationMiddleware(request, response, () => {});
      expect(response.locals.validationResponse.status).to.equal(200);
      nock.cleanAll();
    });

    it('should return a Failed response after verification', async () => {
      nock(fhirDatastoreUrl).post('/fhir/Patient/$validate').reply(412, {
        status: 'Failed',
      });

      const request = {
        body: { ...patientFhirResource1 },
        headers: {
          'content-type': config.contentType,
        },
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
      await validationMiddleware(request, response, () => {});
      expect(statusCode).to.equal(412);
      nock.cleanAll();
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
      nock(mpiUrl).persist().post('/auth/oauth2_token').reply(200, newOauth2TokenGenerated);
      nock(mpiUrl).get('/fhir/links/Patient/0x4').reply(200, {...patientFhirResource1, link: [{other: {reference: 'Patient/0x4'}}, {other: {reference: 'Patient/0x7'}}]});
      nock(mpiUrl).get('/fhir/Patient/2').reply(200, patientFhirResource2);
      const links = encodeURIComponent([createNewPatientRef('0x4'),createNewPatientRef('0x7')].join(','))
      nock(fhirDatastoreUrl).get(`/fhir/Patient?link=${links}`).reply(200, {entry: [{fullUrl: 'Patient/1'}, {fullUrl: 'Patient/2'}]});
      nock(fhirDatastoreUrl).get('/fhir/Patient/1').reply(200, patientFhirResource1);
      nock(fhirDatastoreUrl)
        .get(`/fhir/Encounter?subject=${encodeURIComponent('Patient/1,Patient/2')}`)
        .reply(200, Encounters);
      nock(fhirDatastoreUrl)
        .get(`/fhir/Observation?subject=${encodeURIComponent('Patient/1,Patient/2')}`)
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
      expect(result.status).to.equal('Successful');
      expect(JSON.parse(result.response.body).total).to.equal(4);
      expect(JSON.parse(result.response.body).entry.length).to.equal(4);
      expect(result.orchestrations.length).to.be.greaterThan(0);
      nock.cleanAll();
    });
  });

  describe('*mpiMdmSummaryMiddleware', async () => {
    it('should forward requests when mdm is not supplied', async () => {
      const request = {
        body: {},
        headers: {},
        query: {},
      } as any as Request;

      let result: any = null;
      const response = {
        send: function (body: any) {
          result = body;
        },
        status: function () {
          return this;
        },
      } as any as Response;
      await mpiMdmSummaryMiddleware(request, response, () => {});
      expect(result).to.deep.equal(null);
    });

    it('should preform MDM expansion when mdm param is supplied', async () => {
      nock(mpiUrl).persist().post('/auth/oauth2_token').reply(200, newOauth2TokenGenerated);
      nock(mpiUrl).get('/fhir/links/Patient/0x4').reply(200, {...patientFhirResource1, link: [{other: {reference: 'Patient/0x4'}}, {other: {reference: 'Patient/0x7'}}]});
      nock(mpiUrl).get('/fhir/Patient/2').reply(200, patientFhirResource2);
      const links = encodeURIComponent([createNewPatientRef('0x4'),createNewPatientRef('0x7')].join(','))
      nock(fhirDatastoreUrl).get(`/fhir/Patient?link=${links}`).reply(200, {entry: [{fullUrl: 'Patient/1'}, {fullUrl: 'Patient/2'}]});
      nock(fhirDatastoreUrl).get('/fhir/Patient/1').reply(200, patientFhirResource1);
      nock(fhirDatastoreUrl)
        .get(`/fhir/${patientRefSummary1}/$summary`)
        .reply(200, patientSummary1);
      nock(fhirDatastoreUrl)
        .get(`/fhir/${patientRefSummary2}/$summary`)
        .reply(200, patientSummary2);

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

      await mpiMdmSummaryMiddleware(request, response, () => {});
      expect(statusCode).to.equal(200);
      expect(result.status).to.equal('Successful');
      expect(JSON.parse(result.response.body).total).to.equal(2);
      expect(JSON.parse(result.response.body).entry.length).to.equal(2);
      expect(result.orchestrations.length).to.be.greaterThan(0);
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
      nock(mpiUrl).persist().post('/auth/oauth2_token').reply(200, {});
      nock(mpiUrl).get('/fhir/links/Patient/0x4').reply(200, {...patientFhirResource1, link: [{other: {reference: 'Patient/0x4'}}, {other: {reference: 'Patient/0x7'}}]});
      nock(mpiUrl).get('/fhir/Patient/2').reply(200, patientFhirResource2);
      const links = encodeURIComponent([createNewPatientRef('0x4'),createNewPatientRef('0x7')].join(','))
      nock(fhirDatastoreUrl).get(`/fhir/Patient?link=${links}`).reply(200, {entry: [{fullUrl: 'Patient/1'}, {fullUrl: 'Patient/2'}]});
      nock(fhirDatastoreUrl).get('/fhir/Patient/1').reply(200, patientFhirResource1);

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
