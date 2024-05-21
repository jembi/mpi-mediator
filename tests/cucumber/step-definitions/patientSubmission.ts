// @ts-nocheck
import { Given, When, Then } from 'cucumber';
import { expect } from 'chai';
import rewire from 'rewire';
import supertest from 'supertest';
import path from 'path';
import fetch from 'node-fetch';

import { getConfig } from '../../../src/config/config';
import { getMpiAuthToken } from '../../../src/utils/mpi';

const app = rewire('../../../src/index').__get__('app');
const config = getConfig();

const invalidPatientResource = require(path.resolve(
  __dirname,
  '..',
  'data',
  'invalidPatientResource.json'
));
const validPatientResource = require(path.resolve(
  __dirname,
  '..',
  'data',
  'validPatientResource.json'
));

let server, request, responseBody;

Given(
  'the fhir datastore and the client registry are up and running',
  async (): Promise<void> => {
    const response = await fetch(
      `${config.fhirDatastoreProtocol}://${config.fhirDatastoreHost}:${config.fhirDatastorePort}`
    );
    expect(response.status).to.equal(200);

    const auth = await getMpiAuthToken();

    const clientRegistryResponse = await fetch(
      `${config.mpiProtocol}://${config.mpiHost}:${config.mpiPort}/fhir/Patient`,
      {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
        method: 'GET',
      }
    );

    expect(clientRegistryResponse.status).to.equal(200);

    server = app.listen(3003);
    request = supertest(server);
  }
);

When('a patient resource is sent to the MPI mediator', async (): Promise<void> => {
  const response = await request
    .post('/fhir/Patient')
    .send(validPatientResource)
    .set('Content-Type', 'application/fhir+json')
    .expect(201);

  responseBody = response.body;
});
Then('a patient resource should be created on the client registry', (): void => {
  expect(responseBody.status).to.equal('Successful');
  server.close();
});

When('an invalid patient resource sent to the MPI mediator', async (): Promise<void> => {
  const response = await request
    .post('/fhir/Patient')
    .send(invalidPatientResource)
    .set('Content-Type', 'application/fhir+json')
    .expect(412);

  responseBody = response.body;
});
Then('an error, indicating the resource is invalid, should be sent back', (): void => {
  expect(responseBody.status).to.equal('Failed');
  server.close();
});
