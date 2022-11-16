import { expect } from "chai";
import nock from "nock";
import sinon from "sinon";
import rewire from "rewire";

import { getConfig } from "../../src/config/config";
import logger from '../../src/logger';

import * as kafkaFhir from "../../src/routes/kafkaFhir";
import { Bundle, Resource } from "../../src/types/bundle";
import { RequestDetails } from "../../src/types/request";
import { HandlerResponseObect, ResponseObject } from "../../src/types/response";

const config = getConfig();
const checkClientRegistryResponse = rewire('../../src/routes/kafkaFhir').__get__('checkClientRegistryResponse');
const checkPostResponse = rewire('../../src/routes/kafkaFhir').__get__('checkPostResponse');

describe("Kafka Fhir interaction", (): void => {
  describe("*sendToFhirAndKafka", (): void => {
    it("should send fhir bundle to kafka and the fhir datastore", async (): Promise<void> => {
      const stub = sinon.stub(kafkaFhir, "sendToKafka");
      stub.callsFake(
        async (_bundle: Bundle, topic: string): Promise<Error | null> => {
          expect(topic).to.equal(config.kafkaBundleTopic);
          return null;
        }
      );

      const fhirDatastoreRequestDetailsOrg: RequestDetails = {
        protocol: config.fhirDatastoreProtocol,
        host: config.fhirDatastoreHost,
        port: config.fhirDatastorePort,
        contentType: "application/fhir+json",
        method: "POST",
        path: "/fhir",
        data: "",
      };
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

      const response = await kafkaFhir.sendToFhirAndKafka(
        fhirDatastoreRequestDetailsOrg,
        bundle
      );

      expect(response.status).to.be.equal(200);
      expect(response.body.status).to.be.equal("Success");
      stub.restore();
    });

    it("should return error when sending to kafka fails", async (): Promise<void> => {
      const stub = sinon.stub(kafkaFhir, "sendToKafka");
      stub.callsFake(
        async (_bundle: Bundle, topic: string): Promise<Error | null> => {
          expect(topic).to.equal(config.kafkaBundleTopic);
          return Error("Kafka not available");
        }
      );

      const fhirDatastoreRequestDetailsOrg: RequestDetails = {
        protocol: config.fhirDatastoreProtocol,
        host: config.fhirDatastoreHost,
        port: config.fhirDatastorePort,
        contentType: "application/fhir+json",
        method: "POST",
        path: "/fhir",
        data: "",
      };
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

      const response = await kafkaFhir.sendToFhirAndKafka(
        fhirDatastoreRequestDetailsOrg,
        bundle
      );

      expect(response.status).to.be.equal(500);
      expect(response.body.status).to.be.equal("Failed");
      stub.restore();
    });

    it("should add patient to fhir bundle before sending to kafka", async (): Promise<void> => {
      const stub = sinon.stub(kafkaFhir, "sendToKafka");
      stub.callsFake(
        async (bundle: Bundle, topic: string): Promise<Error | null> => {
          expect(topic).to.equal(config.kafkaBundleTopic);
          expect(bundle.entry.length).to.be.equal(2);
          return null;
        }
      );

      const fhirDatastoreRequestDetailsOrg: RequestDetails = {
        protocol: config.fhirDatastoreProtocol,
        host: config.fhirDatastoreHost,
        port: config.fhirDatastorePort,
        contentType: "application/fhir+json",
        method: "POST",
        path: "/fhir",
        data: "",
      };

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
      const patient: Resource = {
        resourceType: "Patient",
        id: "1233",
      };

      nock(
        `${config.fhirDatastoreProtocol}://${config.fhirDatastoreHost}:${config.fhirDatastorePort}`
      )
        .post(`/fhir`)
        .reply(200, {
          resourceType: "Bundle",
          id: "123",
        });

      const response = await kafkaFhir.sendToFhirAndKafka(
        fhirDatastoreRequestDetailsOrg,
        bundle,
        patient
      );

      expect(response.status).to.be.equal(200);
      expect(response.body.status).to.be.equal("Success");
      stub.restore();
    });
  });

  describe(
    '*checkClientRegistryResponse', () => {
      it('should return error', (): void => {
        const response: ResponseObject = {
          status: 500,
          body: {message: 'Error'}
        };
        const patientResource = null;
        const patientId = '';

        expect(checkClientRegistryResponse(response, patientResource, patientId)).to.equal('Failed');
      });

      it('should return null', (): void => {
        const response: ResponseObject = {
          status: 200,
          body: {message: 'Success'}
        };
        const patientResource = null;
        const patientId = '';

        expect(checkClientRegistryResponse(response, patientResource, patientId)).to.be.null;
      });
    }
  );

  describe('*checkResponse', (): void => {
    it('should check response - failure', (): void => {
      const response: ResponseObject = {
        status: 500,
        body: {message: 'Error'}
      };
      const stub = sinon.stub(logger, 'error');
      stub.callsFake(msg => {
        expect(msg).to.equal(
          `Failed to process Fhir bundle - ${JSON.stringify({message: 'Error'})}`
        );
      });

      checkPostResponse(response);
      stub.restore();
    });

    it('should check response - success', (): void => {
      const response: ResponseObject = {
        status: 200,
        body: {message: 'Success'}
      };
      const stub = sinon.stub(logger, 'info');
      stub.callsFake(msg => {
        expect(msg).to.equal(
          'Successfully sent Fhir Bundle to Fhir datastore and Kafka'
        );
      });

      checkPostResponse(response);
      stub.restore();
    });
  });

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
      const stub1 = sinon.stub(logger, 'info');
      let success: boolean = false;
      stub1.callsFake(msg => { 
        const expectedMessage: string = 'Successfully sent Fhir Bundle to Fhir datastore and Kafka';
        if (msg === expectedMessage) {
          success = true;
        }
      });

      await kafkaFhir.processBundle(bundle);
      expect(success).to.be.true;
      stub.restore();
      stub1.restore();
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
      const stub1 = sinon.stub(logger, 'info');
      let success: boolean = false;
      stub1.callsFake(msg => {
        const expectedMessage: string = 'Successfully sent Fhir Bundle to Fhir datastore and Kafka';
        if (msg === expectedMessage) {
          success = true;
        }
      });

      await kafkaFhir.processBundle(bundle);
      expect(success).to.be.true;
      stub.restore();
      stub1.restore();
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
      const stub1 = sinon.stub(logger, 'info');
      let success: boolean = false;
      stub1.callsFake(msg => {
        const expectedMessage: string = 'Successfully sent Fhir Bundle to Fhir datastore and Kafka';
        if (msg === expectedMessage) {
          success = true;
        }
      });

      await kafkaFhir.processBundle(bundle);
      expect(success).to.be.true;
      stub.restore();
      stub1.restore();
    });
  });
});
