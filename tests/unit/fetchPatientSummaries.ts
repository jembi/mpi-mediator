import { expect } from 'chai';
import { Bundle } from 'fhir/r3';
import nock from 'nock';
import { getConfig } from '../../src/config/config';
import {
  fetchAllPatientSummariesByRefs,
  fetchPatientSummaryByRef,
} from '../../src/routes/handlers/fetchPatientSummaries';
import format from 'date-fns/format';
import { Orchestration } from '../../src/types/response';
import * as patientMethods from '../../src/routes/handlers/fetchPatient';
import sinon from 'sinon';

const config = getConfig();

const { fhirDatastoreHost, fhirDatastorePort, fhirDatastoreProtocol } = config;
const fhirDatastoreUrl = `${fhirDatastoreProtocol}://${fhirDatastoreHost}:${fhirDatastorePort}`;

const emptyPatientRef1 = 'Patient/1';
const emptyPatientRef2 = 'Patient/2';

const emptyBundle: Bundle = {
  resourceType: 'Bundle',
  entry: [],
  link: [],
  meta: {
    lastUpdated: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  },
  type: 'document',
  total: 0,
};

const patientRef1 = 'Patient/testPatient1';
const patientRef2 = 'Patient/testPatient2';

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

const combinedBundle1: Bundle = {
  resourceType: 'Bundle',
  type: 'document',
  link: [],
  meta: {
    lastUpdated: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  },
  entry: [...(patientSummary1.entry || []), ...(patientSummary2.entry || [])],
  total: 2,
};

const patientRef3 = 'Patient/testPatient3';

const patientSummary3: Bundle = {
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

const combinedBundle2: Bundle = {
  resourceType: 'Bundle',
  type: 'document',
  link: [],
  meta: {
    lastUpdated: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  },
  entry: [...(patientSummary3.entry || [])],
  total: 2,
};

describe('FetchPatientSummaries handler', (): void => {
  const mpiPatient = {
    id: 123,
    identifier: [
      {
        system: 'http://cdr.aacahb.gov.et/SmartCareID',
        value: '642b83d3-a43c-41ef-a578-2b730f276bfb',
      },
      {
        system: 'http://cdr.aacahb.gov.et/NationalID',
        value: 'MRN-642b83d3-a43c-41ef-a578-2b730f476bf9',
      },
      {
        system: 'http://cdr.aacahb.gov.et/UAN',
        value: 'UAN-642b83d3-a43c-41ef-a578-2b730f276bfb',
      },
    ],
    name: [
      {
        use: 'official',
        family: 'Rodrigues',
        given: ['Liniee'],
      },
    ],
    telecom: [
      {
        system: 'phone',
        value: '+2519000000',
        use: 'home',
      },
    ],
    gender: 'female',
    birthDate: '1999-06-19',
    address: [
      {
        type: 'physical',
        text: 'Urban',
        state: 'Addis Ababa',
        city: 'Cherkos sub city',
        district: '10',
        line: ['17', '927/5'],
      },
    ],
    maritalStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus',
          code: 'M',
          display: 'Married',
        },
      ],
    },
    link: [
      {
        other: {
          reference: `Patient/123`,
        },
        type: 'refer',
      },
    ],
    resourceType: 'Patient',
  };

  describe('fetchAllPatientSummariesByRefs', async () => {
    it('should return an empty bundle', async () => {
      const stub = sinon.stub(patientMethods, 'fetchPatientById');
      stub.resolves({
        status: 200,
        body: {
          'x-mediator-urn': 'urn',
          status: 'Successful',
          orchestrations: [],
          response: { status: 200, timestamp: '102203002', body: JSON.stringify(mpiPatient) },
        },
      });
      nock(fhirDatastoreUrl).get(`/fhir/${emptyPatientRef1}/$summary`).reply(200, {});
      nock(fhirDatastoreUrl).get(`/fhir/${emptyPatientRef2}/$summary`).reply(200, {});

      const result = await fetchAllPatientSummariesByRefs([
        emptyPatientRef1,
        emptyPatientRef2,
      ]);
      expect(result).to.deep.equal(emptyBundle);
      stub.restore();
    });

    it('should return a bundle with 2 entries for 2 given patients', async () => {
      const stub = sinon.stub(patientMethods, 'fetchPatientById');
      stub.resolves({
        status: 200,
        body: {
          'x-mediator-urn': 'urn',
          status: 'Successful',
          orchestrations: [],
          response: { status: 200, timestamp: '102203002', body: JSON.stringify(mpiPatient) },
        },
      });
      nock(fhirDatastoreUrl).get(`/fhir/${patientRef1}/$summary`).reply(200, patientSummary1);
      nock(fhirDatastoreUrl).get(`/fhir/${patientRef2}/$summary`).reply(200, patientSummary2);

      const orchestrations: Orchestration[] = [];
      const result = await fetchAllPatientSummariesByRefs(
        [patientRef1, patientRef2],
        {},
        orchestrations
      );
      expect(result).to.deep.equal(combinedBundle1);
      expect(orchestrations.length).to.be.greaterThan(0);
      stub.restore();
    });
  });

  describe('fetchPatientSummariesByRefs', async () => {
    it('should return an empty bundle', async () => {
      const stub = sinon.stub(patientMethods, 'fetchPatientById');
      stub.resolves({
        status: 200,
        body: {
          'x-mediator-urn': 'urn',
          status: 'Successful',
          orchestrations: [],
          response: { status: 200, timestamp: '102203002', body: JSON.stringify(mpiPatient) },
        },
      });
      nock(fhirDatastoreUrl).get(`/fhir/${emptyPatientRef1}/$summary`).reply(200, {});

      const result = await fetchPatientSummaryByRef(emptyPatientRef1, {});
      expect(JSON.parse(result.body.response.body)).to.deep.equal(emptyBundle);
      stub.restore();
    });
    it('should return a bundle with 2 entries for 1 given patient', async () => {
      const stub = sinon.stub(patientMethods, 'fetchPatientById');
      stub.resolves({
        status: 200,
        body: {
          'x-mediator-urn': 'urn',
          status: 'Successful',
          orchestrations: [],
          response: { status: 200, timestamp: '102203002', body: JSON.stringify(mpiPatient) },
        },
      });
      nock(fhirDatastoreUrl).get(`/fhir/${patientRef3}/$summary`).reply(200, patientSummary3);

      const result = await fetchPatientSummaryByRef(patientRef3, {});
      expect(JSON.parse(result.body.response.body)).to.deep.equal(combinedBundle2);
      stub.restore();
    });
  });
});
