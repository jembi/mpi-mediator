import { expect } from 'chai';
import nock from 'nock';
import { Bundle, FhirResource, Patient } from 'fhir/r3';

import { getConfig } from '../../src/config/config';
import {
  buildOpenhimResponseObject,
  sendRequest,
  extractPatientEntries,
  modifyBundle,
  createNewPatientRef,
  createHandlerResponseObject,
  mergeBundles,
  transformPatientResourceForMPI,
} from '../../src/utils/utils';
import {
  MpiMediatorResponseObject,
  OpenHimResponseObject,
  ResponseObject,
} from '../../src/types/response';
import { RequestDetails } from '../../src/types/request';
import format from 'date-fns/format';
import { NewPatientMap } from '../../src/types/newPatientMap';

const config = getConfig();

describe('Utils', (): void => {
  describe('*buildOpenhimResponseObject', (): void => {
    it('should return Object', (): void => {
      const transactionStatus: string = 'Success';
      const httpStatus: number = 200;
      const body: object = {
        message: 'Success',
      };
      const contentType: string = 'application/json';

      const returnedObject: OpenHimResponseObject = buildOpenhimResponseObject(
        transactionStatus,
        httpStatus,
        body,
        contentType
      );

      expect(returnedObject['x-mediator-urn']).to.equal(config.mediatorUrn);
      expect(returnedObject.status).to.equal(transactionStatus);
      expect(returnedObject.response).to.have.property('timestamp');
      expect(returnedObject.response.headers).to.deep.equal({
        'Content-Type': contentType,
      });
      expect(JSON.parse(returnedObject.response.body)).to.deep.equal(body);
    });
  });

  describe('*sendData', (): void => {
    it('should fail to post when service being posted to is down', async (): Promise<void> => {
      const reqDetails: RequestDetails = {
        protocol: 'http',
        host: 'test',
        port: 2000,
        path: '',
        method: 'POST',
        data: 'data',
        headers: {},
      };
      const response: ResponseObject = await sendRequest(reqDetails);

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
        data: 'data',
      });
      const dataReturned: object = {
        message: 'Success',
      };
      const reqDetails: RequestDetails = {
        protocol,
        host,
        port,
        path,
        headers: { contentType },
        data,
        method: 'POST',
      };

      nock(`http://${host}:${port}`).post(`${path}`).reply(200, {
        message: 'Success',
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
        message: 'Success',
      };
      const reqDetails: RequestDetails = {
        protocol,
        host,
        port,
        path,
        method: 'GET',
        headers: {},
      };

      nock(`http://${host}:${port}`).get(`${path}`).reply(200, {
        message: 'Success',
      });

      const response: ResponseObject = await sendRequest(reqDetails);

      expect(response.status).to.equal(200);
      expect(response.body).to.deep.equal(dataReturned);
    });
  });

  describe('*extractPatientEntries', (): void => {
    it('should return an empty array when bundle is invalid (zero entries)', (): void => {
      const bundle: Bundle = {
        id: '12',
        entry: [],
        resourceType: 'Bundle',
        type: 'transaction',
      };

      expect(extractPatientEntries(bundle)).to.be.an('array').that.is.empty;
    });

    it('should return empty array when bundle does not have patient', (): void => {
      const bundle: Bundle = {
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
        resourceType: 'Bundle',
        type: 'transaction',
      };

      expect(extractPatientEntries(bundle)).to.be.an('array').that.is.empty;
    });

    it('should return patient', (): void => {
      const patient: FhirResource = {
        resourceType: 'Patient',
        id: '1233',
      };
      const bundle: Bundle = {
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
          {
            fullUrl: 'Patient/1234',
            resource: patient,
          },
        ],
        resourceType: 'Bundle',
        type: 'transaction',
      };

      expect(extractPatientEntries(bundle)).to.deep.equal([bundle.entry?.[1]]);
    });
  });

  describe('*transformPatientResourceForMpi', (): void => {
    it('should remove extensions and managing resources', (): void => {
      const patientResource = {
        id: '436b1164-bbd8-4f78-a63b-a1e291bbb7f3',
        resourceType: 'Patient',
        gender: 'unknown',
        birthDate: '2014-11-30',
        managingOrganization: {
          reference: 'Organization/HIVOrganizationExample2',
        },
        extension: [
          {
            url: 'http://openhie.org/fhir/hiv-casereporting/StructureDefinition/key-population',
            valueCodeableConcept: {
              coding: [
                {
                  code: 'GENERAL-POPULATION',
                },
              ],
            },
          },
        ],
      } as Patient;
      const expectdPatient = {
        id: '436b1164-bbd8-4f78-a63b-a1e291bbb7f3',
        resourceType: 'Patient',
        gender: 'unknown',
        birthDate: '2014-11-30',
      };
      const transformResult = transformPatientResourceForMPI(patientResource);

      expect(transformResult.extension).to.exist;
      expect(transformResult.patient).to.deep.equal(expectdPatient);
      expect(transformResult.managingOrganization).to.exist;
    });
  });

  describe('*modifyBundle', (): void => {
    it('should change the bundle type to transaction from document', (): void => {
      const bundle: Bundle = {
        id: '12',
        entry: [],
        resourceType: 'Bundle',
        type: 'document',
      };

      expect(modifyBundle(bundle).type).to.be.equal('transaction');
    });

    it('should add the request property to the entries', (): void => {
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
      const expectedBundle: Bundle = {
        resourceType: 'Bundle',
        type: 'transaction',
        id: '12',
        entry: [
          {
            fullUrl: 'Encounter/1234',
            resource: {
              resourceType: 'Encounter',
              id: '1233',
              status: 'planned',
            },
            request: {
              method: 'PUT',
              url: 'Encounter/1233',
            },
          },
        ],
      };

      expect(modifyBundle(bundle)).to.be.deep.equal(expectedBundle);
    });

    it('should gut the patient resource, link to MPI patient and set patient to be upserted using MPI id', (): void => {
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
              subject: {
                reference: 'Patient/1233',
              },
              status: 'planned',
            },
          },
          {
            fullUrl: 'Encounter/1111',
            resource: {
              resourceType: 'Encounter',
              id: '1111',
              subject: {
                reference: 'Patient/1233',
              },
              status: 'planned',
            },
          },
          {
            fullUrl: 'Patient/1234',
            resource: {
              resourceType: 'Patient',
              id: '1233',
              name: [
                {
                  given: ['John'],
                  family: 'Doe',
                },
              ],
            },
          },
        ],
      };
      const expectedBundle: Bundle = {
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
                reference: 'Patient/1233',
              },
              status: 'planned',
            },
            request: {
              method: 'PUT',
              url: 'Encounter/1233',
            },
          },
          {
            fullUrl: 'Encounter/1111',
            resource: {
              resourceType: 'Encounter',
              id: '1111',
              subject: {
                reference: 'Patient/1233',
              },
              status: 'planned',
            },
            request: {
              method: 'PUT',
              url: 'Encounter/1111',
            },
          },
          {
            fullUrl: 'Patient/1234',
            resource: {
              resourceType: 'Patient',
              id: '1233',
              link: [
                {
                  type: 'refer',
                  other: {
                    reference: 'http://santedb-mpi:8080/fhir/Patient/xxx',
                  },
                },
              ],
            },
            request: {
              method: 'PUT',
              url: 'Patient/1233',
            },
          },
        ],
      };

      const newPatientIdMap: NewPatientMap = {
        'Patient/1234': {
          mpiResponsePatient: {
            id: 'xxx',
            resourceType: 'Patient',
          },
        },
      };

      expect(modifyBundle(bundle, newPatientIdMap)).to.be.deep.equal(expectedBundle);
    });

    it('should set a patient profile on the gutted patient resource if configured to do so', (): void => {
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
              subject: {
                reference: 'Patient/1233',
              },
              status: 'planned',
            },
          },
          {
            fullUrl: 'Encounter/1111',
            resource: {
              resourceType: 'Encounter',
              id: '1111',
              subject: {
                reference: 'Patient/1233',
              },
              status: 'planned',
            },
          },
          {
            fullUrl: 'Patient/1234',
            resource: {
              resourceType: 'Patient',
              id: '1233',
              name: [
                {
                  given: ['John'],
                  family: 'Doe',
                },
              ],
            },
          },
        ],
      };
      const expectedBundle: Bundle = {
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
                reference: 'Patient/1233',
              },
              status: 'planned',
            },
            request: {
              method: 'PUT',
              url: 'Encounter/1233',
            },
          },
          {
            fullUrl: 'Encounter/1111',
            resource: {
              resourceType: 'Encounter',
              id: '1111',
              subject: {
                reference: 'Patient/1233',
              },
              status: 'planned',
            },
            request: {
              method: 'PUT',
              url: 'Encounter/1111',
            },
          },
          {
            fullUrl: 'Patient/1234',
            resource: {
              meta: {
                profile: ['http://example.com/patient-profile'],
              },
              resourceType: 'Patient',
              id: '1233',
              link: [
                {
                  type: 'refer',
                  other: {
                    reference: 'http://santedb-mpi:8080/fhir/Patient/xxx',
                  },
                },
              ],
            },
            request: {
              method: 'PUT',
              url: 'Patient/1233',
            },
          },
        ],
      };

      const newPatientIdMap: NewPatientMap = {
        'Patient/1234': {
          mpiResponsePatient: {
            id: 'xxx',
            resourceType: 'Patient',
          },
        },
      };

      expect(
        modifyBundle(bundle, newPatientIdMap, 'http://example.com/patient-profile')
      ).to.be.deep.equal(expectedBundle);
    });

    it('should throw if MPI id is missing in response', (): void => {
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
              subject: {
                reference: 'Patient/1233',
              },
              status: 'planned',
            },
          },
          {
            fullUrl: 'Encounter/1111',
            resource: {
              resourceType: 'Encounter',
              id: '1111',
              subject: {
                reference: 'Patient/1233',
              },
              status: 'planned',
            },
          },
          {
            fullUrl: 'Patient/1234',
            resource: {
              resourceType: 'Patient',
              id: '1233',
              name: [
                {
                  given: ['John'],
                  family: 'Doe',
                },
              ],
            },
          },
        ],
      };
      const newPatientIdMap: NewPatientMap = {
        'Patient/1234': {
          mpiResponsePatient: {
            resourceType: 'Patient',
          },
        },
      };

      expect(() => modifyBundle(bundle, newPatientIdMap)).to.throw(
        'ID in MPI response is missing'
      );
    });
  });

  describe('*createNewPatientRef', (): void => {
    it('should create new patient reference', (): void => {
      const expectedRef: string = `${config.mpiProtocol}://${config.mpiHost}:${config.mpiPort}/fhir/Patient/123`;

      const ref = createNewPatientRef('123');
      expect(ref).to.equal(expectedRef);
    });
  });

  describe('*createHandlerResponseObject', (): void => {
    it('should create handler response', (): void => {
      const transactionStatus: string = 'Success';
      const response: ResponseObject = {
        status: 200,
        body: { message: 'Success' },
      };

      const handlerResponse: MpiMediatorResponseObject = createHandlerResponseObject(
        transactionStatus,
        response
      );

      expect(handlerResponse.status).to.equal(200);
      expect(JSON.parse(handlerResponse.body.response.body)).to.deep.equal({
        message: 'Success',
      });
    });
  });

  describe('*mergeBundles', (): void => {
    it('should merge  bundles', async (): Promise<void> => {
      const clientRegistryPatientRef: string = 'http://client-registry:8080/fhir/Patient/1455';
      const bundles: Bundle[] = [
        {
          type: 'document',
          resourceType: 'Bundle',
          id: '12',
          entry: [
            {
              fullUrl: 'Encounter/1111',
              resource: {
                resourceType: 'Encounter',
                id: '1111',
                subject: {
                  reference: clientRegistryPatientRef,
                },
                status: 'planned',
              },
            },
          ],
          link: [
            {
              url: 'http://hapi-fhir:3447/Encounter/1234',
              relation: 'seealso',
            },
          ],
        },
        {
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
                  reference: clientRegistryPatientRef,
                },
                status: 'planned',
              },
            },
          ],
          link: [
            {
              url: 'http://hapi-fhir:3447/Encounter/1111',
              relation: 'next',
            },
          ],
        },
      ];
      const expectedBundle: Bundle = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 2,
        entry: [
          {
            fullUrl: 'Encounter/1111',
            resource: {
              resourceType: 'Encounter',
              id: '1111',
              subject: {
                reference: clientRegistryPatientRef,
              },
              status: 'planned',
            },
          },
          {
            fullUrl: 'Encounter/1234',
            resource: {
              resourceType: 'Encounter',
              id: '1233',
              subject: {
                reference: clientRegistryPatientRef,
              },
              status: 'planned',
            },
          },
        ],
        link: [
          {
            relation: 'subsection',
            url: 'http://hapi-fhir:3447/Encounter/1234',
          },
          {
            relation: 'subsection',
            url: 'http://hapi-fhir:3447/Encounter/1111',
          },
        ],
        meta: {
          lastUpdated: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        },
      };

      const result = await mergeBundles(bundles);
      expect(result).to.be.deep.equal(expectedBundle);
      expect(result.link?.length).to.equal(2);
    });
  });
});
