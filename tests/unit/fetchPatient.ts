import { expect } from 'chai';
import sinon from 'sinon';
import { Bundle } from 'fhir/r3';
import nock from 'nock';

import { getConfig } from '../../src/config/config';
import { fetchPatientById, fetchPatientByQuery } from '../../src/routes/handlers/fetchPatient';
import * as Auth from '../../src/utils/mpi';
import { ClientOAuth2, OAuth2Token } from '../../src/utils/client-oauth2';
import { createNewPatientRef } from '../../src/utils/utils';

const config = getConfig();

const fhirDatastoreUrl = `http://${config.fhirDatastoreHost}:${config.fhirDatastorePort}`;
const mpiUrl = `http://${config.mpiHost}:${config.mpiPort}`;

describe('Fetch patient', (): void => {
  describe('*fetchPatientById', (): void => {
    it('should return an error when there is an error from the fhir datastore', async () => {
      const patientId = 'testPatient';

      nock(fhirDatastoreUrl).get(`/fhir/Patient/${patientId}`).reply(400, { error: 'Error' });

      const result = await fetchPatientById(patientId, '');

      expect(result.status).to.be.equal(400);
      expect(JSON.parse(result.body.response.body)).to.deep.equal({ error: 'Error' });
    });

    it('should fetch patient', async () => {
      const patientId = 'testPatient';
      const mpiPatientId = '1233';

      const patient = {
        id: patientId,
        link: [
          {
            other: {
              reference: `Patient/${mpiPatientId}`,
            },
            type: 'refer',
          },
        ],
        resourceType: 'Patient',
      };
      const patient1 = {
        id: 'mpiPatientId',
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
              reference: `Patient/${mpiPatientId}`,
            },
            type: 'refer',
          },
        ],
        resourceType: 'Patient',
      };

      nock(fhirDatastoreUrl).get(`/fhir/Patient/${patientId}`).reply(200, patient);
      nock(mpiUrl).get(`/fhir/links/Patient/${mpiPatientId}`).reply(200, patient1);

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
      const result = await fetchPatientById(patientId, '');

      expect(result.status).to.be.equal(200);
      expect(JSON.parse(result.body.response.body).id).to.equal(patientId);
      expect(JSON.parse(result.body.response.body)).to.haveOwnProperty('identifier');
      expect(JSON.parse(result.body.response.body)).to.haveOwnProperty('name');
      expect(JSON.parse(result.body.response.body)).to.haveOwnProperty('telecom');
      expect(JSON.parse(result.body.response.body)).to.haveOwnProperty('gender');
      expect(JSON.parse(result.body.response.body)).to.haveOwnProperty('birthDate');
      expect(JSON.parse(result.body.response.body)).to.haveOwnProperty('address');
      expect(JSON.parse(result.body.response.body)).to.haveOwnProperty('maritalStatus');
      expect(result.body.orchestrations.length).to.be.equal(2);
      stub.restore();
    });

    it('should return partial patient', async () => {
      const patientId = 'testPatient';
      const mpiPatientId = '1233';

      const patient = {
        id: patientId,
        link: [
          {
            other: {
              reference: `Patient/${mpiPatientId}`,
            },
            type: 'refer',
          },
        ],
        resourceType: 'Patient',
      };
      const patient1 = {
        id: 'mpiPatientId',
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
              reference: `Patient/${mpiPatientId}`,
            },
            type: 'refer',
          },
        ],
        resourceType: 'Patient',
      };

      nock(fhirDatastoreUrl).get(`/fhir/Patient/${patientId}`).reply(200, patient);
      nock(mpiUrl).get(`/fhir/links/Patient/${mpiPatientId}`).reply(200, patient1);

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
      const result = await fetchPatientById(patientId, 'partial');

      expect(result.status).to.be.equal(200);
      expect(JSON.parse(result.body.response.body).id).to.equal(patientId);
      expect(JSON.parse(result.body.response.body)).to.haveOwnProperty('identifier');
      expect(JSON.parse(result.body.response.body)).to.haveOwnProperty('name');
      expect(JSON.parse(result.body.response.body)).to.haveOwnProperty('gender');
      expect(JSON.parse(result.body.response.body)).to.haveOwnProperty('birthDate');
      expect(result.body.orchestrations.length).to.be.equal(2);
      stub.restore();
    });
  });

  describe('*fetchPatientByQuery', (): void => {
    const patientId = 'testPatient';
    const patientGoldenId = '0x5';
    const patientInteractionId = '0x4';

    const fhirBundle: Bundle = {
      resourceType: 'Bundle',
      type: 'transaction',
      id: '12',
      entry: [
        {
          fullUrl: 'Patient/testPatient',
          resource: {
            id: patientId,
            link: [
              {
                other: {
                  reference: `Patient/${patientInteractionId}`,
                },
                type: 'refer',
              },
            ],
            resourceType: 'Patient',
          },
        },
      ],
    };
    const mpiPatient = {
      id: patientGoldenId,
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
            reference: `Patient/${patientInteractionId}`,
          },
          type: 'refer',
        },
      ],
      resourceType: 'Patient',
    };
    const mpiBundle: Bundle = {
      resourceType: 'Bundle',
      type: 'transaction',
      id: '12',
      entry: [
        {
          fullUrl: 'Encounter/1233',
          resource: {
            resourceType: 'Patient',
            id: patientGoldenId,
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
          },
        },
      ],
    };

    it('should return an error when there is an error from the client registry', async () => {
      const query = { name: 'Bren', family: 'dress' };

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
      nock(mpiUrl).get(`/fhir/Patient?name=Bren&family=dress`).reply(400, { error: 'Error' });

      const result = await fetchPatientByQuery(query);

      expect(result.status).to.be.equal(400);
      expect(JSON.parse(result.body.response.body)).to.deep.equal({ error: 'Error' });
      stub.restore();
    });

    it('should return patients', async () => {
      const query = { name: 'Bren', family: 'dress' };

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
      nock(mpiUrl).get(`/fhir/Patient?name=Bren&family=dress`).reply(200, mpiBundle);
      nock(mpiUrl).get(`/fhir/Patient/${patientGoldenId}`).reply(200, mpiPatient);
      nock(fhirDatastoreUrl).get(`/fhir/Patient?link=${createNewPatientRef(patientInteractionId)}`).reply(200, fhirBundle);
  
      const result = await fetchPatientByQuery(query);

      expect(result.status).to.be.equal(200);
      expect(JSON.parse(result.body.response.body).total).to.deep.equal(1);
      expect(result.body.orchestrations.length).to.be.equal(3);
      stub.restore();
    });
  });
});
