import { expect } from 'chai';
import nock from 'nock';

import { getConfig } from '../../src/config/config';
import {
  buildOpenhimResponseObject,
  postData,
  extractPatientResource,
  extractPatientId,
  modifyBundle
} from '../../src/routes/utils';
import { OpenHimResponseObject, PostResponseObject } from '../../src/types/response';
import { Bundle, Resource } from '../../src/types/bundle';

const config = getConfig();

describe('Utils', () : void => {
  describe('*buildOpenhimResponseObject', () : void => {
    it('should return Object', () : void => {
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

  describe('*postData', () : void => {
    it('should fail to post when service being posted to is down', async () : Promise<void> => {
      const response : PostResponseObject = await postData('http', 'test', 2000, '', 'application/json', 'data')

      expect(response.status).to.equal(500);
      expect(response.body).to.have.property('error');
    });

    it('should post data', async () : Promise<void> => {
      const protocol : string = 'http';
      const host : string = 'example';
      const port : number = 3000;
      const path : string = 'fhir';
      const contentType : string = 'application/json';
      const data = JSON.stringify({
        data: 'data'
      });
      const dataReturned : object = {
        message: 'Success'
      };

      nock(`http://${host}:${port}`)
        .post(`/${path}`)
        .reply(200, {
          message: 'Success'
        });
      
      const response : PostResponseObject = await postData(protocol, host, port, path, contentType, data);

      expect(response.status).to.equal(200);
      expect(response.body).to.deep.equal(dataReturned);
    });
  });

  describe('*extractPatientResource', () : void => {
    it('should return null when bundle is invalid (zero entries)', () : void => {
      const bundle : Bundle = {
        id: '12',
        entry: [],
        resourceType: 'Bundle',
        type: 'transaction'
      };

      expect(extractPatientResource(bundle)).to.be.null;
    });

    it('should return null when bundle does not have patient', () : void => {
      const bundle : Bundle = {
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

    it('should return patient', () : void => {
      const patient : Resource = {
        resourceType: 'Patient',
        id: '1233'
      };
      const bundle : Bundle = {
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

  describe('*extractPatientId', () : void => {
    it('should return null when patient ref does not exist in the bundle', () : void => {
      const bundle : Bundle = {
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
      const patientId : string = 'testPatient1';
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

  describe('*modifyBundle', () : void => {
    it('should change the bundle type to transaction from document', () : void => {
      const bundle : Bundle = {
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

    it('should add the request property to the entries', () : void => {
      const bundle : Bundle = {
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

    it('should replace tempPatientRef', () : void => {
      const tempPatientRef : string = 'Patient/1233';
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
      const clientRegistryPatientRef : string = 'http://client-registry:8080/fhir/Patient/1455';
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

    it('should remove patient resource', () : void => {
      const tempPatientRef : string = 'Patient/1233';
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
      const clientRegistryPatientRef : string = 'http://client-registry:8080/fhir/Patient/1455';
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
});
