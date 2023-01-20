import { expect } from 'chai';
import nock from 'nock';
import sinon from 'sinon';
import { Bundle } from 'fhir/r3';

import * as kafkaFhir from '../../src/utils/kafkaFhir';
import { getConfig } from '../../src/config/config';
import { matchAsyncHandler } from '../../src/routes/handlers/matchPatientAsync';
import { MpiMediatorResponseObject } from '../../src/types/response';

const config = getConfig();

describe('Match Patient Asynchronously', (): void => {
  describe('*matchAsyncHandler', (): void => {
    it('should return error when sending to kafka fails', async (): Promise<void> => {
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

      nock(`http://${config.fhirDatastoreHost}:${config.fhirDatastorePort}`)
        .post('/fhir/Bundle/$validate')
        .reply(200, {});

      const stub = sinon.stub(kafkaFhir, 'sendToKafka');
      stub.callsFake(async (_n, _m): Promise<Error | null> => {
        return Error('Error');
      });

      const response: MpiMediatorResponseObject = await matchAsyncHandler(bundle);
      expect(response.status).to.be.equal(500);
      stub.restore();
    });

    it('should send to kafka successfully', async (): Promise<void> => {
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

      nock(`http://${config.fhirDatastoreHost}:${config.fhirDatastorePort}`)
        .post('/fhir/Bundle/$validate')
        .reply(200, {});

      const stub = sinon.stub(kafkaFhir, 'sendToKafka');
      stub.callsFake(async (_n, _m): Promise<Error | null> => {
        return null;
      });

      const response: MpiMediatorResponseObject = await matchAsyncHandler(bundle);
      expect(response.status).to.be.equal(204);
      stub.restore();
    });
  });
});
