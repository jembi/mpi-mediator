// @ts-nocheck
import { Given, When, Then } from 'cucumber';
import { expect } from 'chai';
import rewire from 'rewire';
import supertest from 'supertest';
import fetch from 'node-fetch';

import { getConfig } from '../../../src/config/config';

const app = rewire('../../../src/index').__get__('app');
const config = getConfig();

let server, request, responseBody;

Given('MPI and FHIR services are up and running', async (): Promise<void> => {
  // MPI
  let response = await fetch(
    `${config.mpiProtocol}://${config.mpiHost}:${config.mpiPort}/auth`
  );
  expect(response.status).to.equal(200);
  // FHIR Datastore
  response = await fetch(
    `${config.fhirDatastoreProtocol}://${config.fhirDatastoreHost}:${config.fhirDatastorePort}`
  );
  expect(response.status).to.equal(200);
  server = app.listen(3003);
  request = supertest(server);
});

When('a $everything search request is sent', async (): Promise<void> => {
  const response = await request
    .get('/fhir/Patient/1/$everything?_mdm=true')
    .set('Content-Type', 'application/fhir+json')
    .expect(200);
  responseBody = response.body;
});

Then('a successful response containing a bundle is sent back', (): void => {
  expect(responseBody.status).to.equal('Success');
  expect(responseBody.response.body.resourceType).to.equal('Bundle');
  server.close();
});

When(
  'When a $everything search request is sent withou the mdm expantion',
  async (): Promise<void> => {
    const response = await request
      .get('/fhir/Patient/1/$everything')
      .set('Content-Type', 'application/fhir+json')
      .expect(200);
    responseBody = response.body;
  }
);

Then('a successful response containing a bundle is sent back', (): void => {
  expect(responseBody.body.status).to.equal('Success');
  expect(responseBody.body.response.body.resourceType).to.equal('Bundle');
  server.close();
});

When('an MDM search request is sent', async (): Promise<void> => {
  const response = await request
    .get('/fhir/Observation?subject:mdm=Patient/1')
    .set('Content-Type', 'application/fhir+json')
    .expect(200);

  responseBody = response.body;
});

Then('a successful MDM response is sent back', (): void => {
  expect(responseBody.status).to.equal('Success');
  server.close();
});
