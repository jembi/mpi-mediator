import { expect } from 'chai';
import { Bundle } from 'fhir/r3';
import nock from 'nock';
import { getConfig } from '../../src/config/config';
import { MpiMediatorResponseObject } from '../../src/types/response';
import {
  fetchAllPatientResourcesByRefs,
  fetchEverythingByRef,
} from '../../src/routes/handlers/fetchPatientResources';
import format from 'date-fns/format';

const config = getConfig();

const patientRef = 'Patient/testPatient';

const { fhirDatastoreProtocol, fhirDatastoreHost, fhirDatastorePort } = config;
const fhirDatastoreUrl = `${fhirDatastoreProtocol}://${fhirDatastoreHost}:${fhirDatastorePort}`;

const emptyBundle: Bundle = {
  resourceType: 'Bundle',
  entry: [],
  link: [],
  meta: {
    lastUpdated: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  },
  type: 'searchset',
  total: 0,
};

const Encounters: Bundle = {
  resourceType: 'Bundle',
  id: 'testBundle',
  type: 'searchset',
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
const Observations: Bundle = {
  resourceType: 'Bundle',
  id: 'testBundle',
  type: 'searchset',
  entry: [
    {
      fullUrl: 'Observation/testObservation',
      resource: {
        resourceType: 'Observation',
        id: 'testObservation',
        status: 'cancelled',
        subject: {
          reference: 'http://sante-mpi:8080/fhir/Patient/testPatient',
        },
        code: {},
      },
    },
  ],
};

const bundle: Bundle = {
  ...emptyBundle,
  total: 2,
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
    {
      fullUrl: 'Observation/testObservation',
      resource: {
        resourceType: 'Observation',
        id: 'testObservation',
        status: 'cancelled',
        subject: {
          reference: 'http://sante-mpi:8080/fhir/Patient/testPatient',
        },
        code: {},
      },
    },
  ],
};

describe('FetchPatientResources handler', (): void => {
  describe('*fetchAllPatientResources', (): void => {
    it('should return an empty bundle', async () => {
      nock(fhirDatastoreUrl)
        .get(`/fhir/Encounter?subject=${encodeURIComponent(patientRef)}`)
        .reply(200, {});
      nock(fhirDatastoreUrl)
        .get(`/fhir/Observation?subject=${encodeURIComponent(patientRef)}`)
        .reply(200, {});
      nock(fhirDatastoreUrl)
        .get(`/fhir/Appointment?patient=${encodeURIComponent(patientRef)}`)
        .reply(200, {});

      const result = await fetchAllPatientResourcesByRefs([patientRef]);
      expect(result).to.deep.equal(emptyBundle);
    });
    it('should return a bundle of resources', async () => {
      nock(fhirDatastoreUrl)
        .get(`/fhir/Encounter?subject=${encodeURIComponent(patientRef)}`)
        .reply(200, Encounters);
      nock(fhirDatastoreUrl)
        .get(`/fhir/Observation?subject=${encodeURIComponent(patientRef)}`)
        .reply(200, Observations);

      const result = await fetchAllPatientResourcesByRefs([patientRef]);
      expect(result).to.deep.equal(bundle);
    });
  });
  describe('*FetchPatientResources', (): void => {
    it('should return an empty bundle', async () => {
      nock(fhirDatastoreUrl)
        .get(`/fhir/Encounter?subject=${encodeURIComponent(patientRef)}`)
        .reply(200, {});
      nock(fhirDatastoreUrl)
        .get(`/fhir/Observation?subject=${encodeURIComponent(patientRef)}`)
        .reply(200, {});
      nock(fhirDatastoreUrl)
        .get(`/fhir/Appointment?patient=${encodeURIComponent(patientRef)}`)
        .reply(200, {});

      const result: MpiMediatorResponseObject = await fetchEverythingByRef(patientRef);
      expect(JSON.parse(result.body.response.body)).to.deep.equal(emptyBundle);
    });

    it('should succesfully return bundle of various resources', async (): Promise<void> => {
      nock(fhirDatastoreUrl)
        .get(`/fhir/Encounter?subject=${encodeURIComponent(patientRef)}`)
        .reply(200, Encounters);
      nock(fhirDatastoreUrl)
        .get(`/fhir/Observation?subject=${encodeURIComponent(patientRef)}`)
        .reply(200, Observations);

      const result: MpiMediatorResponseObject = await fetchEverythingByRef(patientRef);

      expect(JSON.parse(result.body.response.body)).to.deep.equal(bundle);
    });
  });
});
