// @ts-nocheck
import { Given, When, Then } from "cucumber";
import { expect } from "chai";
import sinon from "sinon";
import rewire from "rewire";
import supertest from "supertest";
import path from "path";
import fetch from "node-fetch";

import { getConfig } from "../../../src/config/config";
import { createAuthHeaderToken } from "../../../src/routes/utils";
import * as KafkaFhir from "../../../src/routes/kafkaFhir";

const app = rewire("../../../src/index").__get__("app");
const config = getConfig();

const bundle = require(path.resolve(__dirname, "..", "data", "bundle.json"));
const invalidPatientRefBundle = require(path.resolve(__dirname, "..", "data", "invalidPatientRefBundle.json"));
const invalidFhirBundle = require(path.resolve(__dirname, '..', 'data', 'invalidFhirBundle.json'));

let server: unknown, request: unknown, responseBody: unknown;

const sendToKafka = sinon.stub(KafkaFhir, "sendToKafka");
sendToKafka.callsFake((_bundle, _topic) => {
  return null;
});

Given(
  "the fhir datastore, kafka and the client registry are up and running",
  async (): Promise<void> => {
    const fhirResponse = await fetch(
      `${config.fhirDatastoreProtocol}://${config.fhirDatastoreHost}:${config.fhirDatastorePort}`
    );
    expect(fhirResponse.status).to.equal(200);

    const auth = await createAuthHeaderToken();

    const clientRegistryResponse = await fetch(
      `${config.clientRegistryProtocol}://${config.clientRegistryHost}:${config.clientRegistryPort}/fhir/Patient`,
      {
        headers: {
          Authorization: auth.token,
        },
        method: "GET",
      }
    );

    expect(clientRegistryResponse.status).to.equal(200);

    server = app.listen(3003);
    request = supertest(server);
  }
);

When("a fhir bundle is send to the MPI mediator", async (): Promise<void> => {
  const response = await request
    .post("/fhir")
    .send(bundle)
    .set("content-type", "application/fhir+json")
    .expect(200);

  responseBody = response.body;
});

When("an invalid fhir bundle is send to the MPI mediator", async (): Promise<void> => {
  const response = await request
    .post("/fhir")
    .send(invalidFhirBundle)
    .set("content-type", "application/fhir+json")
    .expect(412);

  responseBody = response.body;
});

When(
  "a fhir bundle with an invalid patient reference is send to the MPI mediator",
  async (): Promise<void> => {
    const response = await request
      .post("/fhir")
      .send(invalidPatientRefBundle)
      .set("content-type", "application/fhir+json")
      .expect(404);

    responseBody = response.body;
  }
);

When(
  "a fhir bundle with a valid patient reference is send to the MPI mediator",
  async (): Promise<void> => {
    const auth = await createAuthHeaderToken();
    const clientRegResponse = await fetch(
      `${config.clientRegistryProtocol}://${config.clientRegistryHost}:${config.clientRegistryPort}/fhir/Patient`,
      {
        headers: {
          Authorization: auth.token,
          'Content-Type': 'application/fhir+json'
        },
        method: "POST",
        body: JSON.stringify({resourceType: 'Patient'})
      }
    );

    const patient = await clientRegResponse.json();
    
    // Add valid patient reference
    invalidPatientRefBundle.entry[0].resource.subject.reference = `Patient/${patient.id}`;

    const response = await request
      .post("/fhir")
      .send(invalidPatientRefBundle)
      .set("content-type", "application/fhir+json")
      .expect(200);

    responseBody = response.body;
  }
);

Then(
  "a patient should be created on the client registry",
  async (): Promise<void> => {
    const auth = await createAuthHeaderToken();
    let patientId: string;

    for (
      let index = 0;
      index < responseBody.response.body.entry.length;
      index++
    ) {
      if (responseBody.response.body.entry[index].resource) {
        const resource = responseBody.response.body.entry[index].resource;

        if (resource.resourceType === "Patient") {
          patientId = resource.id;
        }
      }
    }

    const response = await fetch(
      `${config.clientRegistryProtocol}://${config.clientRegistryHost}:${config.clientRegistryPort}/fhir/Patient/${patientId}`,
      {
        headers: {
          Authorization: auth.token,
        },
        method: "GET",
      }
    );

    expect(response.status).to.be.equal(200);
  }
);

Then(
  `it's clinical data should be stored in the fhir datastore`,
  async (): Promise<void> => {
    const auth = await createAuthHeaderToken();
    const observationId = "testObservation";

    const response = await fetch(
      `${config.fhirDatastoreProtocol}://${config.fhirDatastoreHost}:${config.fhirDatastorePort}/fhir/Observation/${observationId}`,
      {
        headers: {
          Authorization: auth.token,
        },
        method: "GET",
      }
    );

    expect(response.status).to.be.equal(200);
    server.close();

  }
);

Then('an error, indicating the patient does not exist, should be sent back', (): void => {
  expect(responseBody.status).to.equal('Failed')
  server.close();
});

Then('a response, indicating the clinical data has been stored, should be sent back', (): void => {
  expect(responseBody.status).to.equal('Success')
  server.close();
});

Then('a response, indicating validation failure, should be sent back', (): void => {
  expect(responseBody.status).to.equal('Failed')
  sendToKafka.restore();
  server.close();
});
