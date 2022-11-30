import { expect } from "chai";
import nock from "nock";
import sinon from "sinon";

import { getConfig } from "../../src/config/config";

import * as kafkaFhir from "../../src/routes/kafkaFhir";
import { Bundle, Resource } from "../../src/types/bundle";
import { RequestDetails } from "../../src/types/request";

const config = getConfig();

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
});
