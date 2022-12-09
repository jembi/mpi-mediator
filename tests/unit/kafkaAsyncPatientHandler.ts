import { expect } from 'chai';
import nock from 'nock';
import sinon from 'sinon';
import { Bundle } from 'fhir/r3';

import * as kafkaFhir from '../../src/utils/kafkaFhir';
import { getConfig } from '../../src/config/config';
import { MpiMediatorResponseObject } from '../../src/types/response';
import * as Auth from '../../src/utils/mpi';
import { ClientOAuth2, OAuth2Token } from '../../src/utils/client-oauth2';

const config = getConfig();

describe('Kafka Async Patient Handler', (): void => {
  describe('*processBundle', (): void => {
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
              status: 'planned',
            },
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

      const stub = sinon.stub(kafkaFhir, 'sendToFhirAndKafka');
      stub.callsFake(async (_n, _m): Promise<MpiMediatorResponseObject> => {
        return {
          status: 200,
          body: {
            'x-mediator-urn': '123',
            response: {
              status: 200,
              body: {},
              timestamp: '12-12-2012',
              headers: {
                'content-type': 'application/json',
              },
            },
            status: 'Success',
          },
        };
      });

      const result = await kafkaFhir.processBundle(bundle);

      expect(result.status).to.equal(200);
      stub.restore();
    });

    it('should process bundle with patient', async (): Promise<void> => {
      const bundle: Bundle = {
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
                reference: `Patient/12333`,
              },
              status: 'planned',
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
      const patientId: string = 'testPatient';
      const clientRegistryResponse = {
        resourceType: 'Patient',
        id: patientId,
      };

      nock(`${config.mpiProtocol}://${config.mpiHost}:${config.mpiPort}`)
        .post(`/fhir/Patient`)
        .reply(201, clientRegistryResponse);

      nock(`${config.mpiProtocol}://${config.mpiHost}:${config.mpiPort}`)
        .post(`/auth/oauth2_token`)
        .reply(200, { access_token: 'accessToken' });

      const stub = sinon.stub(kafkaFhir, 'sendToFhirAndKafka');
      stub.callsFake(async (_n, _m): Promise<MpiMediatorResponseObject> => {
        return {
          status: 200,
          body: {
            'x-mediator-urn': '123',
            response: {
              status: 200,
              body: {},
              timestamp: '12-12-2012',
              headers: {
                'content-type': 'application/json',
              },
            },
            status: 'Success',
          },
        };
      });
      const stub1 = sinon.stub(Auth, 'getMpiAuthToken');
      stub1.callsFake(async (): Promise<OAuth2Token> => {
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
      const result = await kafkaFhir.processBundle(bundle);

      expect(result.status).to.equal(200);
      stub.restore();
      stub1.restore();
    });

    it('should process bundle with patient ref', async (): Promise<void> => {
      const patientId: string = 'testPatient';
      const bundle: Bundle = {
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
                reference: `Patient/${patientId}`,
              },
              status: 'planned',
            },
          },
        ],
      };
      const clientRegistryResponse = {
        resourceType: 'Patient',
        id: patientId,
      };

      nock(`${config.mpiProtocol}://${config.mpiHost}:${config.mpiPort}`)
        .get(`/fhir/Patient/${patientId}`)
        .reply(200, clientRegistryResponse);

      const stub1 = sinon.stub(Auth, 'getMpiAuthToken');
      stub1.callsFake(async (): Promise<OAuth2Token> => {
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
      const stub = sinon.stub(kafkaFhir, 'sendToFhirAndKafka');
      stub.callsFake(async (_n, _m): Promise<MpiMediatorResponseObject> => {
        return {
          status: 200,
          body: {
            'x-mediator-urn': '123',
            response: {
              status: 200,
              body: {},
              timestamp: '12-12-2012',
              headers: {
                'content-type': 'application/json',
              },
            },
            status: 'Success',
          },
        };
      });
      const result = await kafkaFhir.processBundle(bundle);

      expect(result.status).to.equal(200);
      stub.restore();
      stub1.restore();
      nock.cleanAll();
    });
  });
});
