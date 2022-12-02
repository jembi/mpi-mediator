import { expect } from 'chai';
import nock from 'nock';
import sinon from 'sinon';

import * as kafkaFhir from '../../src/utils/kafkaFhir';
import { getConfig } from '../../src/config/config';
import { RequestDetails } from '../../src/types/request';
import { Bundle } from '../../src/types/bundle';
import { HandlerResponseObect } from '../../src/types/response';
import { matchSyncHandler } from '../../src/routes/handlers/matchPatientSync';

const config = getConfig();

describe('Match Patient Synchronously', (): void => {
  describe('*matchSychHanlder', (): void => {
    const fhirDatastoreRequestDetailsOrg: RequestDetails = {
      protocol: config.fhirDatastoreProtocol,
      host: config.fhirDatastoreHost,
      port: config.fhirDatastorePort,
      contentType: 'application/fhir+json',
      method: 'POST',
      path: '/fhir',
      data: ''
    };

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
            },
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
              id: '1233'
            },
            request: {
              method: 'PUT',
              url: 'Encounter/1233'
            }
          }
        ]
      };

      const stub = sinon.stub(kafkaFhir, 'sendToFhirAndKafka');
      stub.callsFake(async (requestDetails: RequestDetails, bundle: Bundle): Promise<HandlerResponseObect> => {
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
              body: { mesage: 'Success' },
              timestamp: '12/02/1991'
            }
          }
        };
      });

      const handlerResponse = await matchSyncHandler(bundle);
      
      expect(handlerResponse.status).to.be.equal(200);
      expect(handlerResponse.body.status).to.be.equal('Success');
      stub.restore();
    });

    it(
      'should return error response when patient creation fails in Client Registry',
      async (): Promise<void> => {
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
            },
          },
          {
            fullUrl: 'Patient/1234',
            resource: {
              resourceType: 'Patient',
              id: '1233',
            },
          }
        ],
      };
      const error = {
        error: 'Internal Server'
      };

      nock(`${config.clientRegistryProtocol}://${config.clientRegistryHost}:${config.clientRegistryPort}`)
        .post('/fhir/Patient')
        .reply(500, error);
  
      const handlerResponse = await matchSyncHandler(bundle);
  
      expect(handlerResponse.status).to.be.equal(500);
      expect(handlerResponse.body.status).to.be.equal('Failed');
      expect(handlerResponse.body.response.body).to.deep.equal(error);
    });

    it(
      'should return error response when patient referenced does not exist the in Client Registry',
      async (): Promise<void> => {
      const patientId: string = '1234'
      const bundle = {
        type: 'document',
        resourceType: 'Bundle',
        id: '12',
        entry: [
          {
            fullUrl: 'Encounter/1234',
            resource: {
              resourceType: 'Encounter',
              id: '1233',
              subject: {
                reference: `Patient/${patientId}`
              }
            },
          }
        ],
      };
      const error = {
        error: 'Resource not found'
      };

      nock(`${config.clientRegistryProtocol}://${config.clientRegistryHost}:${config.clientRegistryPort}`)
        .get(`/fhir/Patient/${patientId}`)
        .reply(404, error);
  
      const handlerResponse = await matchSyncHandler(bundle);
  
      expect(handlerResponse.status).to.be.equal(404);
      expect(handlerResponse.body.status).to.be.equal('Failed');
      expect(handlerResponse.body.response.body).to.deep.equal(error);
    });

    it(
      'should send to the FHir store and Kafka when patient exists in the Client Registry',
      async (): Promise<void> => {
      const patientId : string = 'testPatient'
      const bundle = {
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
                reference: `Patient/${patientId}`
              }
            },
          }
        ],
      };

      const modifiedBundle = {
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
                reference: `${
                  config.clientRegistryProtocol
                }://${config.clientRegistryHost
                }:${config.clientRegistryPort}/fhir/Patient/${patientId}`
              }
            },
            request: {
              method: 'PUT',
              url: 'Encounter/1233'
            }
          }
        ]
      };
      const clientRegistryResponse = {
        resourceType: 'Patient',
        id: patientId,
      };

      nock(`${config.clientRegistryProtocol}://${config.clientRegistryHost}:${config.clientRegistryPort}`)
        .get(`/fhir/Patient/${patientId}`)
        .reply(200, clientRegistryResponse);

      const stub = sinon.stub(kafkaFhir, 'sendToFhirAndKafka');
      stub.callsFake(async (requestDetails: RequestDetails, bundle: Bundle) : Promise<HandlerResponseObect> => {
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
              body: { mesage: 'Success' },
              timestamp: '12/02/1991'
            }
          }
        };
      });
  
      const handlerResponse = await matchSyncHandler(bundle);
  
      expect(handlerResponse.status).to.be.equal(200);
      expect(handlerResponse.body.status).to.be.equal('Success');
      stub.restore();
    });

    it(
      'should send to the FHir store and Kafka when patient is created in the Client Registry',
      async (): Promise<void> => {
      const patientId : string = 'testPatient'
      const bundle = {
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
                reference: `Patient/12333`
              }
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
      const clientRegistryRef = `${
        config.clientRegistryProtocol
      }://${config.clientRegistryHost
      }:${config.clientRegistryPort}/fhir/Patient/${patientId}`;

      const modifiedBundle = {
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
                reference: clientRegistryRef
              }
            },
            request: {
              method: 'PUT',
              url: 'Encounter/1233'
            }
          }
        ]
      };
      const clientRegistryResponse = {
        resourceType: 'Patient',
        id: patientId,
      };

      nock(`${config.clientRegistryProtocol}://${config.clientRegistryHost}:${config.clientRegistryPort}`)
        .post(`/fhir/Patient`)
        .reply(201, clientRegistryResponse);

      const stub = sinon.stub(kafkaFhir, 'sendToFhirAndKafka');
      stub.callsFake(async (
        requestDetails, bundle, patient, newPatientRef) : Promise<HandlerResponseObect> => {
        expect(requestDetails).to.deep.equal(fhirDatastoreRequestDetailsOrg);
        expect(bundle).to.be.deep.equal(modifiedBundle);
        expect(patient).to.be.deep.equal(clientRegistryResponse);
        expect(newPatientRef).to.equal(clientRegistryRef);

        return {
          status: 200,
          body: {
            'x-mediator-urn': '123',
            status: 'Success',
            response: {
              status: 200,
              headers: { 'content-type': 'application/json' },
              body: { mesage: 'Success' },
              timestamp: '12/02/1991'
            }
          }
        };
      });
  
      const handlerResponse = await matchSyncHandler(bundle);
  
      expect(handlerResponse.status).to.be.equal(200);
      expect(handlerResponse.body.status).to.be.equal('Success');
      stub.restore();
    });
  });
});
