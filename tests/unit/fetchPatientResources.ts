import { expect } from 'chai';
import { Bundle } from 'fhir/r3';
import nock from 'nock';

import { getConfig } from '../../src/config/config';
import { validate } from '../../src/routes/handlers/validation';
import { MpiMediatorResponseObject } from '../../src/types/response';
import { fetchPatientResources } from '../../src/routes/handlers/fetchPatientResources';

const config = getConfig();

const bundle: Bundle = {
  resourceType: 'Bundle',
  id: 'testBundle',
  type: 'transaction',
  entry: [
    {
      fullUrl: 'Encounter/testEncounter',
      resource: {
        resourceType: 'Encounter',
        id: 'testEncounter',
        status: 'arrived',
        subject: {
          reference: 'http://sante-mpi:8080/fhir/Patient/testPatient',
        },
      },
    },
  ],
};

describe('FetchPatientResources handler', (): void => {
  describe('*FetchPatientResources', (): void => {
    it('should return an empty bundle', async (): Promise<void> => {
      nock(`http://${config.fhirDatastoreHost}:${config.fhirDatastorePort}`)
        .get('/fhir/Observation')
        .reply(404, {});
      nock(`http://${config.fhirDatastoreHost}:${config.fhirDatastorePort}`)
        .get('/fhir/Encounter')
        .reply(404, {});
      nock(`http://${config.fhirDatastoreHost}:${config.fhirDatastorePort}`)
        .get('/fhir/Appointment')
        .reply(404, {});

      const patientId = 'testPatient';

      const result: MpiMediatorResponseObject = await fetchPatientResources(patientId);
      expect(result.status).to.equal(404);
    });

    it('should succesfully return bundle of various resources', async (): Promise<void> => {
      nock(`http://${config.fhirDatastoreHost}:${config.fhirDatastorePort}`)
        .get(
          `/fhir/Encounter?subject=${encodeURIComponent(
            'http://sante-mpi:8080/fhir/Patient/testPatient'
          )}`
        )
        .reply(200, bundle);

      const patientId = 'testPatient';

      const result: MpiMediatorResponseObject = await fetchPatientResources(patientId);

      console.log(result.body.response.body);

      expect(result.status).to.equal(200);
    });
  });
});
