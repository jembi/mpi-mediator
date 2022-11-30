import { expect } from "chai";
import nock from "nock";
import sinon from "sinon";

import * as kafkaFhir from "../../src/routes/kafkaFhir";
import { Bundle } from "../../src/types/bundle";
import { getConfig } from "../../src/config/config";
import { HandlerResponseObect } from "../../src/types/response";

const config = getConfig();

describe('Kafka Async Patient Handler', (): void => {
  describe('*processBundle', (): void => {
    it(
      'should process bundle without patient or patient ref',
      async (): Promise<void> => {
      const bundle: Bundle = {
        type: "document",
        resourceType: "Bundle",
        id: "12",
        entry: [
          {
            fullUrl: "Encounter/1234",
            resource: {
              resourceType: "Encounter",
              id: "1233",
            },
          },
        ],
      };
      nock(
        `${config.fhirDatastoreProtocol}://${config.fhirDatastoreHost}:${config.fhirDatastorePort}`
      )
        .post(`/fhir`)
        .reply(200, {
          resourceType: "Bundle",
          id: "123",
        });

      const stub = sinon.stub(kafkaFhir, 'sendToFhirAndKafka');
      stub.callsFake(async (_n, _m): Promise<HandlerResponseObect> => {  
        return {
          status: 200,
          body: {
            "x-mediator-urn": '123',
            response: {
              status: 200,
              body: {},
              timestamp: '12-12-2012',
              headers: {
                "content-type": 'application/json'
              }
            },
            status: 'Success'
          }
        };
      });

      const result = await kafkaFhir.processBundle(bundle);
      
      expect(result.status).to.equal(200);
      stub.restore();
    });

    it(
      'should process bundle with patient',
      async (): Promise<void> => {
      const bundle = {
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
                reference: `Patient/12333`
              }
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
      const patientId : string = 'testPatient';
      const clientRegistryResponse = {
        resourceType: 'Patient',
        id: patientId,
      };

      nock(`${config.clientRegistryProtocol}://${config.clientRegistryHost}:${config.clientRegistryPort}`)
        .post(`/fhir/Patient`)
        .reply(201, clientRegistryResponse);
    
      const stub = sinon.stub(kafkaFhir, 'sendToFhirAndKafka');
      stub.callsFake(async (_n, _m): Promise<HandlerResponseObect> => {
        return {
          status: 200,
          body: {
            "x-mediator-urn": '123',
            response: {
              status: 200,
              body: {},
              timestamp: '12-12-2012',
              headers: {
                "content-type": 'application/json'
              }
            },
            status: 'Success'
          }
        };
      });
      const result = await kafkaFhir.processBundle(bundle);
      
      expect(result.status).to.equal(200);
      stub.restore();
    });

    it(
      'should process bundle with patient ref',
      async (): Promise<void> => {
      const patientId : string = 'testPatient';
      const bundle = {
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
                reference: `Patient/${patientId}`
              }
            },
          }
        ],
      };
      const clientRegistryResponse = {
        resourceType: 'Patient',
        id: patientId,
      };

      nock(`${config.clientRegistryProtocol}://${config.clientRegistryHost}:${config.clientRegistryPort}`)
        .get(`/fhir/Patient/${patientId}`)
        .reply(200, clientRegistryResponse);
    
      const stub = sinon.stub(kafkaFhir, 'sendToFhirAndKafka');
      stub.callsFake(async (_n, _m): Promise<HandlerResponseObect> => {
        return {
          status: 200,
          body: {
            "x-mediator-urn": '123',
            response: {
              status: 200,
              body: {},
              timestamp: '12-12-2012',
              headers: {
                "content-type": 'application/json'
              }
            },
            status: 'Success'
          }
        };
      });
      const result = await kafkaFhir.processBundle(bundle);
      
      expect(result.status).to.equal(200);
      stub.restore();
    });
  });
});
