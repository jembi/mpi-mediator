// @ts-nocheck
import { Given, When, Then } from 'cucumber';
import { expect } from 'chai';
import rewire from 'rewire';
import supertest from 'supertest';
import path from 'path';
import fetch from 'node-fetch';

import { getConfig } from '../../../src/config/config';

const app = rewire('../../../src/index').__get__('app');
const config = getConfig();

const invalidFhirBundle = require(
  path.resolve(__dirname, '..', 'data', 'invalidFhirBundle.json')
);
const validFhirBundle = require(
  path.resolve(__dirname, '..', 'data', 'validFhirBundle.json')
);

let server, request, responseBody;

Given('the fhir datastore service is up and running', async () : Promise<void> => {
  const response = await fetch(`${config.fhirDatastoreProtocol}://${config.fhirDatastoreHost}:${config.fhirDatastorePort}`);
  expect(response.status).to.equal(200);

  server = app.listen(3003);
  request = supertest(server);
});

When('an invalid bundle is sent through', async () : Promise<void> => {
  const response = await request
    .post('/fhir/validate')
    .send(invalidFhirBundle)
    .set('Content-Type', 'application/fhir+json')
    .expect(412);

  responseBody = response.body;
});

When('a valid bundle is sent through', async () : Promise<void> => {
  const response = await request
    .post('/fhir/validate')
    .send(validFhirBundle)
    .set('Content-Type', 'application/fhir+json')
    .expect(200);
  
  responseBody = response.body;
});

Then('an error response should be sent back', () : void => {
  expect(responseBody.status).to.equal('Failed');
  server.close();
});

Then('a success response should be sent back', () : void => {
  expect(responseBody.status).to.equal('Success');
  server.close();
});
