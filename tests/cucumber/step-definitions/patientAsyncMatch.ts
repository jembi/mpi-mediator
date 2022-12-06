// @ts-nocheck
import { Given, When, Then } from "cucumber";
import { expect } from "chai";
import rewire from "rewire";
import path from 'path';
import supertest from 'supertest';
import fetch from 'node-fetch';

import { getConfig } from '../../../src/config/config';

const config = getConfig();
const app = rewire("../../../src/index").__get__("app");

const invalidFhirBundle = require(
  path.resolve(__dirname, '..', 'data', 'invalidFhirBundle.json')
);
const validFhirBundle = require(
  path.resolve(__dirname, '..', 'data', 'validFhirBundle.json')
);

let server: unknown, request: unknown, responseBody: unknown;

Given('the mediator is up and running', async () : Promise<void> => {
  const response = await fetch(`${config.fhirDatastoreProtocol}://${config.fhirDatastoreHost}:${config.fhirDatastorePort}`);
  expect(response.status).to.equal(200);

  server = app.listen(3003);
  request = supertest(server);
});

When('an invalid fhir bundle is sent to the MPI mediator', async () : Promise<void> => {
  const response = await request
    .post('/async/fhir')
    .send(invalidFhirBundle)
    .set('Content-Type', 'application/fhir+json')
    .expect(412);

  responseBody = response.body;
});

When('a valid fhir bundle is sent, and forwarded to kafka', async () : Promise<void> => {
  const response = await request
    .post('/async/fhir')
    .send(validFhirBundle)
    .set('Content-Type', 'application/fhir+json')
    .expect(204);

  responseBody = response.body;
});

Then('an invalid fhir bundle response should be sent back', () : void => {
  expect(responseBody.status).to.equal('Failed');
  server.close();
});

Then('a response, indicating success, should be sent back', () : void => {
  expect(responseBody).to.deep.equal({});
  server.close();
});
