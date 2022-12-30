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

const refUrl = `http://santedb-mpi:8080/fhir/${patientRef}`;

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
              reference: 'http://sante-mpi:8080/fhir/Patient/testPatient',
            },
          },
        ],
      },
    },
  ],
};

const bundle: Bundle = {
  ...emptyBundle,
  total: 3,
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
              reference: 'http://sante-mpi:8080/fhir/Patient/testPatient',
            },
          },
        ],
      },
    },
  ],
};

describe('FetchPatientResources handler', (): void => {
  describe('*fetchAllPatientResources', (): void => {
    it('should return an empty bundle', async () => {
      nock(fhirDatastoreUrl)
        .get(`/fhir/Encounter?subject=${encodeURIComponent(refUrl)}`)
        .reply(200, {});
      nock(fhirDatastoreUrl)
        .get(`/fhir/Observation?subject=${encodeURIComponent(refUrl)}`)
        .reply(200, {});
      nock(fhirDatastoreUrl)
        .get(`/fhir/Appointment?patient=${encodeURIComponent(refUrl)}`)
        .reply(200, {});

      const result = await fetchAllPatientResourcesByRefs([patientRef]);
      expect(result).to.deep.equal(emptyBundle);
    });
    it('should return a bundle of resources', async () => {
      nock(fhirDatastoreUrl)
        .get(`/fhir/Encounter?subject=${encodeURIComponent(refUrl)}`)
        .reply(200, Encounters);
      nock(fhirDatastoreUrl)
        .get(`/fhir/Observation?subject=${encodeURIComponent(refUrl)}`)
        .reply(200, Observations);
      nock(fhirDatastoreUrl)
        .get(`/fhir/Appointment?patient=${encodeURIComponent(refUrl)}`)
        .reply(200, Appointments);

      const result = await fetchAllPatientResourcesByRefs([patientRef]);
      expect(result).to.deep.equal(bundle);
    });
  });
  describe('*FetchPatientResources', (): void => {
    it('should return an empty bundle', async () => {
      nock(fhirDatastoreUrl)
        .get(`/fhir/Encounter?subject=${encodeURIComponent(refUrl)}`)
        .reply(200, {});
      nock(fhirDatastoreUrl)
        .get(`/fhir/Observation?subject=${encodeURIComponent(refUrl)}`)
        .reply(200, {});
      nock(fhirDatastoreUrl)
        .get(`/fhir/Appointment?patient=${encodeURIComponent(refUrl)}`)
        .reply(200, {});

      const result: MpiMediatorResponseObject = await fetchEverythingByRef(patientRef);
      expect(result.body.response.body).to.deep.equal(emptyBundle);
    });

    it('should succesfully return bundle of various resources', async (): Promise<void> => {
      nock(fhirDatastoreUrl)
        .get(`/fhir/Encounter?subject=${encodeURIComponent(refUrl)}`)
        .reply(200, Encounters);
      nock(fhirDatastoreUrl)
        .get(`/fhir/Observation?subject=${encodeURIComponent(refUrl)}`)
        .reply(200, Observations);
      nock(fhirDatastoreUrl)
        .get(`/fhir/Appointment?patient=${encodeURIComponent(refUrl)}`)
        .reply(200, Appointments);

      const result: MpiMediatorResponseObject = await fetchEverythingByRef(patientRef);

      expect(result.body.response.body).to.deep.equal(bundle);
    });
  });
});
