import { expect } from 'chai';
import nock from 'nock';
import sinon from 'sinon';

import * as kafkaFhir from '../../src/utils/kafkaFhir';
import { getConfig } from '../../src/config/config';
import { RequestDetails } from '../../src/types/request';
import { MpiMediatorResponseObject } from '../../src/types/response';
import { matchSyncHandler } from '../../src/routes/handlers/matchPatientSync';
import * as Auth from '../../src/utils/mpi';
import { ClientOAuth2, OAuth2Token } from '../../src/utils/client-oauth2';
import { Bundle, FhirResource } from 'fhir/r3';

const config = getConfig();

const mockSuccefullValidation = () => {
  nock(`http://${config.fhirDatastoreHost}:${config.fhirDatastorePort}`)
    .post('/fhir/Bundle/$validate')
    .reply(200, {});
};

describe('Match Patient Synchronously', (): void => {
  describe('*matchSychHanlder', (): void => {
    const fhirDatastoreRequestDetailsOrg: RequestDetails = {
      protocol: config.fhirDatastoreProtocol,
      host: config.fhirDatastoreHost,
      port: config.fhirDatastorePort,
      headers: { 'Content-Type': 'application/fhir+json' },
      method: 'POST',
      path: '/fhir',
    };

    it('should return error when validation fails', async (): Promise<void> => {
      const bundle: Bundle = {
        type: 'document',
        resourceType: 'Bundle',
        id: '12',
        entry: [
          {
            fullUrl: 'Encounter/1234',
            resource: {
              resourceType: 'Encounter',
              id: '1233',
              status: 'planned',
            },
          },
        ],
      };

      nock(`http://${config.fhirDatastoreHost}:${config.fhirDatastorePort}`)
        .post('/fhir/Bundle/$validate')
        .reply(500, {});

      const response: MpiMediatorResponseObject = await matchSyncHandler(bundle);
      expect(response.status).to.be.equal(500);
    });

    it('should process bundle without patient or patient ref', async (): Promise<void> => {
      const bundle: Bundle = {
        type: 'document',
        resourceType: 'Bundle',
        id: '12',
        entry: [
          {
            fullUrl: 'Encounter/1234',
            resource: {
              resourceType: 'Encounter',
              id: '1233',
            } as FhirResource,
          },
        ],
      };
      const modifiedBundle = {
        resourceType: 'Bundle',
        type: 'transaction',
        id: '12',
        entry: [
          {
            fullUrl: 'Encounter/1234',
            resource: {
              resourceType: 'Encounter',
              id: '1233',
            },
            request: {
              method: 'PUT',
              url: 'Encounter/1233',
            },
          },
        ],
      };

      mockSuccefullValidation();

      const stub = sinon.stub(kafkaFhir, 'sendToFhirAndKafka');
      stub.callsFake(
        async (
          requestDetails: RequestDetails,
          bundle: Bundle
        ): Promise<MpiMediatorResponseObject> => {
          expect(requestDetails).to.deep.equal(fhirDatastoreRequestDetailsOrg);
          expect(bundle).to.be.deep.equal(modifiedBundle);

          return {
            status: 200,
            body: {
              'x-mediator-urn': '123',
              status: 'Success',
              response: {
                status: 200,
                headers: { 'content-type': 'application/json' },
                body: '',
                timestamp: '12/02/1991',
              },
            },
          };
        }
      );

      const handlerResponse = await matchSyncHandler(bundle);

      expect(handlerResponse.status).to.be.equal(200);
      expect(handlerResponse.body.status).to.be.equal('Success');
      stub.restore();
    });

    it('should return error response when patient creation fails in Client Registry', async (): Promise<void> => {
      const bundle: Bundle = {
        type: 'document',
        resourceType: 'Bundle',
        id: '12',
        entry: [
          {
            fullUrl: 'Encounter/1234',
            resource: {
              resourceType: 'Encounter',
              id: '1233',
            } as FhirResource,
          },
          {
            fullUrl: 'Patient/1234',
            resource: {
              resourceType: 'Patient',
              id: '1233',
            },
          },
        ],
      };
      const error = {
        error: 'Internal Server',
      };

      mockSuccefullValidation();

      nock(`${config.mpiProtocol}://${config.mpiHost}:${config.mpiPort}`)
        .post('/fhir/Patient')
        .reply(500, error);

      const stub = sinon.stub(Auth, 'getMpiAuthToken');
      stub.callsFake(async (): Promise<OAuth2Token> => {
        const clientData = {
          clientId: '',
          clientSecret: 'secret',
          accessTokenUri: 'test',
          scopes: [],
        };
        const client = new ClientOAuth2(clientData);

        const oauth2 = new OAuth2Token(client, {
          token_type: 'bearer',
          access_token: 'accessToken',
          refresh_token: 'refreshToken',
          expires_in: '3',
        });
        return oauth2;
      });

      const handlerResponse = await matchSyncHandler(bundle);

      expect(handlerResponse.status).to.be.equal(500);
      expect(handlerResponse.body.status).to.be.equal('Failed');
      expect(JSON.parse(handlerResponse.body.response.body)).to.deep.equal({
        errors: [error],
      });
      stub.restore();
    });

    it('should send to the FHIR store and Kafka when patient exists in the Client Registry', async (): Promise<void> => {
      const patientId: string = 'testPatient';
      const bundle: Bundle = {
        type: 'document',
        resourceType: 'Bundle',
        id: '12',
        entry: [
          {
            fullUrl: 'Encounter/1233',
            resource: {
              resourceType: 'Encounter',
              id: '1233',
              subject: {
                reference: `Patient/${patientId}`,
              },
              status: 'planned',
            },
          },
        ],
      };

      const modifiedBundle: Bundle = {
        resourceType: 'Bundle',
        type: 'transaction',
        id: '12',
        entry: [
          {
            fullUrl: 'Encounter/1233',
            resource: {
              resourceType: 'Encounter',
              id: '1233',
              subject: {
                reference: `Patient/${patientId}`,
              },
              status: 'planned',
            },
            request: {
              method: 'PUT',
              url: 'Encounter/1233',
            },
          },
        ],
      };
      const clientRegistryResponse = {
        resourceType: 'Patient',
        id: patientId,
      };

      mockSuccefullValidation();

      nock(`${config.mpiProtocol}://${config.mpiHost}:${config.mpiPort}`)
        .get(`/fhir/Patient/${patientId}`)
        .reply(200, clientRegistryResponse);

      const stub = sinon.stub(kafkaFhir, 'sendToFhirAndKafka');
      stub.callsFake(
        async (
          requestDetails: RequestDetails,
          bundle: Bundle
        ): Promise<MpiMediatorResponseObject> => {
          expect(requestDetails).to.deep.equal(fhirDatastoreRequestDetailsOrg);
          expect(bundle).to.be.deep.equal(modifiedBundle);

          return {
            status: 200,
            body: {
              'x-mediator-urn': '123',
              status: 'Success',
              response: {
                status: 200,
                headers: { 'content-type': 'application/json' },
                body: '',
                timestamp: '12/02/1991',
              },
            },
          };
        }
      );

      const stub1 = sinon.stub(Auth, 'getMpiAuthToken');
      stub1.callsFake(async (): Promise<OAuth2Token> => {
        const clientData = {
          clientId: '',
          clientSecret: 'secret',
          accessTokenUri: 'test',
          scopes: [],
        };
        const client = new ClientOAuth2(clientData);

        const oauth2 = new OAuth2Token(client, {
          token_type: 'bearer',
          access_token: 'accessToken',
          refresh_token: 'refreshToken',
          expires_in: '3',
        });
        return oauth2;
      });

      const handlerResponse = await matchSyncHandler(bundle);

      expect(handlerResponse.status).to.be.equal(200);
      expect(handlerResponse.body.status).to.be.equal('Success');
      stub.restore();
      stub1.restore();
    });

    it('should send gutted patient and clinical data to the FHIR store and Kafka when patient is created in the Client Registry', async (): Promise<void> => {
      const patientId: string = 'testPatient';
      const bundle: Bundle = {
        type: 'document',
        resourceType: 'Bundle',
        id: '12',
        entry: [
          {
            fullUrl: 'Encounter/1233',
            resource: {
              resourceType: 'Encounter',
              id: '1233',
              subject: {
                reference: `Patient/12333`,
              },
              status: 'planned',
            },
          },
          {
            fullUrl: `Patient/12333`,
            resource: {
              resourceType: 'Patient',
              id: '12333',
            },
          },
        ],
      };

      const modifiedBundle: Bundle = {
        resourceType: 'Bundle',
        type: 'transaction',
        id: '12',
        entry: [
          {
            fullUrl: 'Encounter/1233',
            resource: {
              resourceType: 'Encounter',
              id: '1233',
              subject: {
                reference: `Patient/12333`,
              },
              status: 'planned',
            },
            request: {
              method: 'PUT',
              url: 'Encounter/1233',
            },
          },
          {
            fullUrl: 'Patient/12333',
            request: {
              method: 'PUT',
              url: 'Patient/12333',
            },
            resource: {
              id: '12333',
              link: [
                {
                  other: {
                    reference: 'http://santedb-mpi:8080/fhir/Patient/testPatient',
                  },
                  type: 'refer',
                },
              ],
              resourceType: 'Patient',
            },
          },
        ],
      };
      const clientRegistryResponse = {
        resourceType: 'Patient',
        id: patientId,
      };

      mockSuccefullValidation();

      nock(`${config.mpiProtocol}://${config.mpiHost}:${config.mpiPort}`)
        .post(`/fhir/Patient`)
        .reply(201, clientRegistryResponse);

      const stub = sinon.stub(Auth, 'getMpiAuthToken');
      stub.callsFake(async (): Promise<OAuth2Token> => {
        const clientData = {
          clientId: '',
          clientSecret: 'secret',
          accessTokenUri: 'test',
          scopes: [],
        };
        const client = new ClientOAuth2(clientData);

        const oauth2 = new OAuth2Token(client, {
          token_type: 'bearer',
          access_token: 'accessToken',
          refresh_token: 'refreshToken',
          expires_in: '3',
        });
        return oauth2;
      });
      const stub1 = sinon.stub(kafkaFhir, 'sendToFhirAndKafka');
      stub1.callsFake(
        async (requestDetails, bundle, newPatientRef): Promise<MpiMediatorResponseObject> => {
          expect(requestDetails).to.deep.equal(fhirDatastoreRequestDetailsOrg);
          expect(bundle).to.be.deep.equal(modifiedBundle);
          expect(newPatientRef).to.deep.equal({
            'Patient/12333': {
              mpiResponsePatient: {
                id: 'testPatient',
                resourceType: 'Patient',
              },
              mpiTransformResult: {
                extension: undefined,
                managingOrganization: undefined,
                patient: {
                  id: '12333',
                  resourceType: 'Patient',
                },
              },
              restoredPatient: {
                id: 'testPatient',
                resourceType: 'Patient',
              },
            },
          });

          return {
            status: 200,
            body: {
              'x-mediator-urn': '123',
              status: 'Success',
              response: {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: '',
                timestamp: '12/02/1991',
              },
            },
          };
        }
      );

      const handlerResponse = await matchSyncHandler(bundle);

      expect(handlerResponse.status).to.be.equal(200);
      expect(handlerResponse.body.status).to.be.equal('Success');
      stub.restore();
      stub.restore();
    });
  });
});
