import { expect } from 'chai';
import nock from 'nock';

import { getConfig } from '../../src/config/config';
import {
  buildOpenhimResponseObject,
  sendRequest,
  extractPatientResource,
  extractPatientId,
  modifyBundle,
  createAuthHeaderToken,
  createNewPatientRef,
  createHandlerResponseObject
} from '../../src/routes/utils';
import { HandlerResponseObect, OpenHimResponseObject, ResponseObject } from '../../src/types/response';
import { Bundle, Resource } from '../../src/types/bundle';
import { RequestDetails } from '../../src/types/request';

const config = getConfig();

describe('Utils', (): void => {
  describe('*buildOpenhimResponseObject', (): void => {
    it('should return Object', (): void => {
      const transactionStatus : string = 'Success';
      const httpStatus : number = 200;
      const body : object = {
        message: 'Success'
      };
      const contentType : string = 'application/json';
      
      const returnedObect : OpenHimResponseObject = buildOpenhimResponseObject(
        transactionStatus,
        httpStatus,
        body,
        contentType
      );

      expect(returnedObect['x-mediator-urn']).to.equal(config.mediatorUrn);
      expect(returnedObect.status).to.equal(transactionStatus);
      expect(returnedObect.response).to.have.property('timestamp');
      expect(returnedObect.response.headers).to.deep.equal({
        'content-type': contentType
      });
      expect(returnedObect.response.body).to.deep.equal(body);
    });
  });

  describe('*sendData', (): void => {
    it('should fail to post when service being posted to is down', async (): Promise<void> => {
      const reqDetails : RequestDetails = {
        protocol: 'http',
        host: 'test',
        port: 2000,
        path: '',
        method: 'POST',
        data: 'data'
      };
      const response : ResponseObject = await sendRequest(reqDetails);

      expect(response.status).to.equal(500);
      expect(response.body).to.have.property('error');
    });

    it('should post data', async (): Promise<void> => {
      const protocol: string = 'http';
      const host: string = 'example';
      const port: number = 3000;
      const path: string = '/fhir';
      const contentType: string = 'application/json';
      const data = JSON.stringify({
        data: 'data'
      });
      const dataReturned: object = {
        message: 'Success'
      };
      const reqDetails: RequestDetails = {
        protocol,
        host,
        port,
        path,
        contentType,
        data,
        method: 'POST'
      };

      nock(`http://${host}:${port}`)
        .post(`${path}`)
        .reply(200, {
          message: 'Success'
        });
      
      const response: ResponseObject = await sendRequest(reqDetails);

      expect(response.status).to.equal(200);
      expect(response.body).to.deep.equal(dataReturned);
    });

    it('should get data', async (): Promise<void> => {
      const protocol: string = 'http';
      const host: string = 'example';
      const port: number = 3000;
      const path: string = '/fhir';
      const dataReturned: object = {
        message: 'Success'
      };
      const reqDetails: RequestDetails = {
        protocol,
        host,
        port,
        path,
        method: 'GET'
      };

      nock(`http://${host}:${port}`)
        .get(`${path}`)
        .reply(200, {
          message: 'Success'
        });
      
      const response: ResponseObject = await sendRequest(reqDetails);

      expect(response.status).to.equal(200);
      expect(response.body).to.deep.equal(dataReturned);
    });
  });

  describe('*extractPatientResource', (): void => {
    it('should return null when bundle is invalid (zero entries)', (): void => {
      const bundle: Bundle = {
        id: '12',
        entry: [],
        resourceType: 'Bundle',
        type: 'transaction'
      };

      expect(extractPatientResource(bundle)).to.be.null;
    });

    it('should return null when bundle does not have patient', (): void => {
      const bundle: Bundle = {
        id: '12',
        entry: [{
          fullUrl: 'Encounter/1234',
          resource: {
            resourceType: 'Encounter',
            id: '1233'
          }
        }],
        resourceType: 'Bundle',
        type: 'transaction'
      };

      expect(extractPatientResource(bundle)).to.be.null;
    });

    it('should return patient', (): void => {
      const patient: Resource = {
        resourceType: 'Patient',
        id: '1233'
      };
      const bundle: Bundle = {
        id: '12',
        entry: [{
          fullUrl: 'Patient/1234',
          resource: patient
        }],
        resourceType: 'Bundle',
        type: 'transaction'
      };

      expect(extractPatientResource(bundle)).to.deep.equal(patient);
    });
  });

  describe('*extractPatientId', (): void => {
    it('should return null when patient ref does not exist in the bundle', () : void => {
      const bundle: Bundle = {
        id: '12',
        entry: [{
          fullUrl: 'Encounter/1234',
          resource: {
            resourceType: 'Encounter',
            id: '1233'
          }
        }],
        resourceType: 'Bundle',
        type: 'transaction'
      };

      expect(extractPatientId(bundle)).to.be.null;
    });

    it('should return patient id', () : void => {
      const patientId: string = 'testPatient1';
      const bundle = {
        id: '12',
        entry: [{
          fullUrl: 'Encounter/1234',
          resource: {
            resourceType: 'Encounter',
            id: '1233',
            subject: {
              reference: `Patient/${patientId}`
            }
          }
        }],
        resourceType: 'Bundle',
        type: 'transaction'
      };

      expect(extractPatientId(bundle)).to.be.equal(patientId);
    });
  });

  describe('*modifyBundle', (): void => {
    it('should change the bundle type to transaction from document', (): void => {
      const bundle: Bundle = {
        id: '12',
        entry: [],
        resourceType: 'Bundle',
        type: 'document'
      };

      expect(
        modifyBundle(
          bundle,
          'patientRef',
          'clientRegistryPatientRef'
        ).type
      ).to.be.equal('transaction');
    });

    it('should add the request property to the entries', (): void => {
      const bundle: Bundle = {
        type: 'document',
        resourceType: 'Bundle',
        id: '12',
        entry: [{
          fullUrl: 'Encounter/1234',
          resource: {
            resourceType: 'Encounter',
            id: '1233'
          }
        }]
      };
      const expectedBundle = {
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

      expect(
        modifyBundle(
          bundle,
          'patientRef',
          'clientRegistryPatientRef'
        )
      ).to.be.deep.equal(expectedBundle);
    });

    it('should replace tempPatientRef', (): void => {
      const tempPatientRef: string = 'Patient/1233';
      const bundle = {
        type: 'document',
        resourceType: 'Bundle',
        id: '12',
        entry: [{
          fullUrl: 'Encounter/1234',
          resource: {
            resourceType: 'Encounter',
            id: '1233',
            subject: {
              reference: tempPatientRef
            }
          }
        }]
      };
      const clientRegistryPatientRef: string = 'http://client-registry:8080/fhir/Patient/1455';
      const expectedBundle = {
        resourceType: 'Bundle',
        type: 'transaction',
        id: '12',
        entry: [
          {
            fullUrl: 'Encounter/1234',
            resource: {
              resourceType: 'Encounter',
              id: '1233',
              subject: {
                reference: clientRegistryPatientRef
              }
            },
            request: {
              method: 'PUT',
              url: 'Encounter/1233'
            }
          }
        ]
      };

      expect(
        modifyBundle(
          bundle,
          tempPatientRef,
          clientRegistryPatientRef
        )
      ).to.be.deep.equal(expectedBundle);
    });

    it('should remove patient resource', (): void => {
      const tempPatientRef: string = 'Patient/1233';
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
                reference: tempPatientRef
              }
            }
          },
          {
            fullUrl: 'Encounter/1111',
            resource: {
              resourceType: 'Encounter',
              id: '1111',
              subject: {
                reference: tempPatientRef
              }
            }
          },
          {
            fullUrl: 'Patient/1234',
            resource: {
              resourceType: 'Patient',
              id: '1233'
            }
          }
       ]
      };
      const clientRegistryPatientRef: string = 'http://client-registry:8080/fhir/Patient/1455';
      const expectedBundle = {
        resourceType: 'Bundle',
        type: 'transaction',
        id: '12',
        entry: [
          {
            fullUrl: 'Encounter/1234',
            resource: {
              resourceType: 'Encounter',
              id: '1233',
              subject: {
                reference: clientRegistryPatientRef
              }
            },
            request: {
              method: 'PUT',
              url: 'Encounter/1233'
            }
          },
          {
            fullUrl: 'Encounter/1111',
            resource: {
              resourceType: 'Encounter',
              id: '1111',
              subject: {
                reference: clientRegistryPatientRef
              }
            },
            request: {
              method: 'PUT',
              url: 'Encounter/1111'
            }
          },
        ]
      };

      expect(
        modifyBundle(
          bundle,
          tempPatientRef,
          clientRegistryPatientRef
        )
      ).to.be.deep.equal(expectedBundle);
    });
  });

  describe('*createAuthHeaderToken', (): void => {
    it('should return error when server error occurs', async (): Promise<void> => {
      const errorMessage = {
        message: 'Server down!'
      };

      nock(`${config.clientRegistryProtocol}://${config.clientRegistryHost}:${config.clientRegistryPort}`)
        .post(`${config.clientRegistryAuthPath}`)
        .reply(500, errorMessage);

      const response = await createAuthHeaderToken();
      expect(response.error).to.be.equal(JSON.stringify(errorMessage));
    });

    it('should return error when server error occurs', async (): Promise<void> => {
      const successMessage = {
        access_token: 'test'
      };

      nock(`${config.clientRegistryProtocol}://${config.clientRegistryHost}:${config.clientRegistryPort}`)
        .post(`${config.clientRegistryAuthPath}`)
        .reply(200, successMessage);

      const response = await createAuthHeaderToken();
      expect(response.token).to.be.equal(`${config.clientRegistryAuthHeaderType} test`);
    });
  });

  describe('*createNewPatientRef', (): void => {
    it('should create new patient reference', () : void => {
      const expectedRef : string = `${
        config.clientRegistryProtocol
      }://${
        config.clientRegistryHost
      }:${config.clientRegistryPort}/fhir/Patient/123`;

      const ref = createNewPatientRef({id: '123'});
      expect(ref).to.equal(expectedRef);
    });
  });

  describe('*createHandlerResponseObject', (): void => {
    it('should create handler response', () : void => {
      const transactionStatus : string = 'Success';
      const response : ResponseObject = {
        status: 200,
        body: {message: 'Success'}
      };

      const handlerResponse : HandlerResponseObect = createHandlerResponseObject(
        transactionStatus,
        response
      );

      expect(handlerResponse.status).to.equal(200);
      expect(handlerResponse.body.response.body).to.deep.equal({
        message: 'Success'
      });
    });
  });
});
