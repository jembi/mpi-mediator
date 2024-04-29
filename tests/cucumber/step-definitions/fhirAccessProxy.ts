// @ts-nocheck
import { Given, When, Then, Before } from 'cucumber';
import { expect } from 'chai';
import rewire from 'rewire';
import supertest from 'supertest';
import fetch from 'node-fetch';
import path from 'path';

import { getConfig } from '../../../src/config/config';

const app = rewire('../../../src/index').__get__('app');
const config = getConfig();
const bundle = require(path.resolve(__dirname, '..', 'data', 'bundle.json'));

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

When('an $everything search request is sent', async (): Promise<void> => {
  const response = await request
    .get('/fhir/Patient/testPatient/$everything?_mdm=true')
    .set('Content-Type', 'application/fhir+json')
    .expect(200);
  responseBody = response.body;
});

Then(
  'a successful response containing a bundle of related patient resources is sent back',
  (): void => {
    expect(responseBody.status).to.equal('Success');
    expect(JSON.parse(responseBody.response.body).resourceType).to.equal('Bundle');
    server.close();
  }
);

When(
  'an $everything search request is sent without the MDM param',
  async (): Promise<void> => {
    const bundleSubmission = await request
      .post('/fhir')
      .send(bundle)
      .set('content-type', 'application/fhir+json')
      .expect(200);

    const { response } = JSON.parse(bundleSubmission.body.response.body).entry.find((entry) =>
      entry.response.location.startsWith('Patient')
    );

    const patientId = response.location.split('/')[1];

    const res = await request
      .get(`/fhir/Patient/${patientId}/$everything`)
      .set('Content-Type', 'application/fhir+json')
      .expect(200);
    responseBody = res.body;
  }
);

Then('a successful response containing a bundle is sent back', (): void => {
  expect(responseBody.status).to.equal('Success');
  expect(JSON.parse(responseBody.response.body).resourceType).to.equal('Bundle');
  server.close();
});

When('an MDM search request is sent', async (): Promise<void> => {
  const response = await request
    .get('/fhir/Observation?subject:mdm=Patient/testPatient')
    .set('Content-Type', 'application/fhir+json')
    .expect(200);

  responseBody = response.body;
});

Then('a successful MDM response is sent back', (): void => {
  expect(responseBody.status).to.equal('Success');
  server.close();
});
