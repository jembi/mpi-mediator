import { expect } from 'chai';
import nock from 'nock';
import sinon from 'sinon';
import { Bundle, FhirResource, Patient, Resource } from 'fhir/r3';

import { getConfig } from '../../src/config/config';

import * as kafkaFhir from '../../src/utils/kafkaFhir';
import { RequestDetails } from '../../src/types/request';
import { NewPatientMap } from '../../src/types/newPatientMap';

const config = getConfig();

describe('Kafka Fhir interaction', (): void => {
  describe('*sendToFhirAndKafka', (): void => {
    it('should send fhir bundle to kafka and the fhir datastore', async (): Promise<void> => {
      const stub = sinon.stub(kafkaFhir, 'sendToKafka');
      stub.callsFake(async (_bundle: Bundle, topic: string): Promise<Error | null> => {
        expect(topic).to.equal(config.kafkaBundleTopic);
        return null;
      });

      const fhirDatastoreRequestDetailsOrg: RequestDetails = {
        protocol: config.fhirDatastoreProtocol,
        host: config.fhirDatastoreHost,
        port: config.fhirDatastorePort,
        headers: { contentType: 'application/fhir+json' },
        method: 'POST',
        path: '/fhir',
        data: '',
      };
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

      nock(
        `${config.fhirDatastoreProtocol}://${config.fhirDatastoreHost}:${config.fhirDatastorePort}`
      )
        .post(`/fhir`)
        .reply(200, {
          resourceType: 'Bundle',
          id: '123',
        });

      const response = await kafkaFhir.sendToFhirAndKafka(
        fhirDatastoreRequestDetailsOrg,
        bundle
      );

      expect(response.status).to.be.equal(200);
      expect(response.body.status).to.be.equal('Success');
      expect(response.body.orchestrations.length).to.be.equal(2);
      expect(response.body.orchestrations[0].name).to.equal('Saving data in Fhir Datastore - hapi-fhir');
      expect(response.body.orchestrations[0].response.status).to.equal(200);
      expect(response.body.orchestrations[1].name).to.equal('Sending to message bus - kafka');
      expect(response.body.orchestrations[1].response.status).to.equal(200);
      stub.restore();
    });

    it('should return error when sending to kafka fails', async (): Promise<void> => {
      const stub = sinon.stub(kafkaFhir, 'sendToKafka');
      stub.callsFake(async (_bundle: Bundle, topic: string): Promise<Error | null> => {
        expect(topic).to.equal(config.kafkaBundleTopic);
        return Error('Kafka not available');
      });

      const fhirDatastoreRequestDetailsOrg: RequestDetails = {
        protocol: config.fhirDatastoreProtocol,
        host: config.fhirDatastoreHost,
        port: config.fhirDatastorePort,
        headers: { contentType: 'application/fhir+json' },
        method: 'POST',
        path: '/fhir',
        data: '',
      };
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

      nock(
        `${config.fhirDatastoreProtocol}://${config.fhirDatastoreHost}:${config.fhirDatastorePort}`
      )
        .post(`/fhir`)
        .reply(200, {
          resourceType: 'Bundle',
          id: '123',
        });

      const response = await kafkaFhir.sendToFhirAndKafka(
        fhirDatastoreRequestDetailsOrg,
        bundle
      );

      expect(response.status).to.be.equal(500);
      expect(response.body.status).to.be.equal('Failed');
      expect(response.body.orchestrations[0].name).to.equal('Saving data in Fhir Datastore - hapi-fhir');
      expect(response.body.orchestrations[0].response.status).to.equal(200);
      expect(response.body.orchestrations[1].name).to.equal('Sending to message bus - kafka');
      expect(response.body.orchestrations[1].response.status).to.equal(500);
      stub.restore();
    });

    it('should restore full patient data to fhir bundle before sending to kafka', async (): Promise<void> => {
      const stub = sinon.stub(kafkaFhir, 'sendToKafka');
      stub.callsFake(async (bundle: Bundle, topic: string): Promise<Error | null> => {
        expect(topic).to.equal(config.kafkaBundleTopic);
        expect(bundle.entry?.length).to.be.equal(2);
        expect(bundle.entry?.[1].resource).deep.equal(restoredPatient);
        return null;
      });

      const fhirDatastoreRequestDetailsOrg: RequestDetails = {
        protocol: config.fhirDatastoreProtocol,
        host: config.fhirDatastoreHost,
        port: config.fhirDatastorePort,
        headers: { contentType: 'application/fhir+json' },
        method: 'POST',
        path: '/fhir',
        data: '',
      };

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
              url: 'Patient/xxx',
            },
          },
        ],
      };

      const restoredPatient: Patient = {
        resourceType: 'Patient',
        id: '1233',
        name: [
          {
            given: ['John'],
            family: 'Doe',
          },
        ],
        extension: [
          {
            url: 'http://hl7.org/fhir/StructureDefinition/patient-mothersMaidenName',
            valueString: 'Jane Doe',
          },
        ],
        managingOrganization: {
          reference: 'Organization/1',
        },
      };

      const newPatientMap: NewPatientMap = {
        'Patient/1234': {
          restoredPatient,
        },
      };

      nock(
        `${config.fhirDatastoreProtocol}://${config.fhirDatastoreHost}:${config.fhirDatastorePort}`
      )
        .post(`/fhir`)
        .reply(200, {
          resourceType: 'Bundle',
          id: '123',
        });

      const response = await kafkaFhir.sendToFhirAndKafka(
        fhirDatastoreRequestDetailsOrg,
        bundle,
        newPatientMap
      );

      expect(response.status).to.be.equal(200);
      expect(response.body.status).to.be.equal('Success');
      stub.restore();
    });

    it('should ADD restored patient data to fhir bundle before sending to kafka if no matching patient is found in bundle', async (): Promise<void> => {
      const stub = sinon.stub(kafkaFhir, 'sendToKafka');
      stub.callsFake(async (bundle: Bundle, topic: string): Promise<Error | null> => {
        expect(topic).to.equal(config.kafkaBundleTopic);
        expect(bundle.entry?.length).to.be.equal(3);
        expect(bundle.entry?.[2].resource).deep.equal(restoredPatient);
        return null;
      });

      const fhirDatastoreRequestDetailsOrg: RequestDetails = {
        protocol: config.fhirDatastoreProtocol,
        host: config.fhirDatastoreHost,
        port: config.fhirDatastorePort,
        headers: { contentType: 'application/fhir+json' },
        method: 'POST',
        path: '/fhir',
        data: '',
      };

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
            fullUrl: 'Patient/5555',
            resource: {
              resourceType: 'Patient',
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
              url: 'Patient/xxx',
            },
          },
        ],
      };

      const restoredPatient: Patient = {
        resourceType: 'Patient',
        id: '1233',
        name: [
          {
            given: ['John'],
            family: 'Doe',
          },
        ],
        extension: [
          {
            url: 'http://hl7.org/fhir/StructureDefinition/patient-mothersMaidenName',
            valueString: 'Jane Doe',
          },
        ],
        managingOrganization: {
          reference: 'Organization/1',
        },
      };

      const newPatientMap: NewPatientMap = {
        'Patient/1234': {
          restoredPatient,
        },
      };

      nock(
        `${config.fhirDatastoreProtocol}://${config.fhirDatastoreHost}:${config.fhirDatastorePort}`
      )
        .post(`/fhir`)
        .reply(200, {
          resourceType: 'Bundle',
          id: '123',
        });

      const response = await kafkaFhir.sendToFhirAndKafka(
        fhirDatastoreRequestDetailsOrg,
        bundle,
        newPatientMap
      );

      expect(response.status).to.be.equal(200);
      expect(response.body.status).to.be.equal('Success');
      stub.restore();
    });
  });
});
