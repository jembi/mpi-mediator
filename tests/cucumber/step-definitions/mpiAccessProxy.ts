// @ts-nocheck
import { Given, When, Then } from 'cucumber';
import { expect } from 'chai';
import rewire from 'rewire';
import supertest from 'supertest';
import fetch from 'node-fetch';

import { getConfig } from '../../../src/config/config';

const app = rewire('../../../src/index').__get__('app');
const config = getConfig();

const invalidMatchParams = {
  resourceType: 'Parameters',
  id: 'example',
  parameter: [
    {
      name: 'resource',
      resource: {
        resourceType: 'Patient',
        name: [
          {
            family: ['Smith'],
            given: ['John'],
          },
        ],
      },
    },
  ],
};

const validMatchParams = {
  ...invalidMatchParams,
  parameter: [
    ...invalidMatchParams.parameter,
    {
      name: 'count',
      valueInteger: '3',
    },
    {
      name: 'onlyCertainMatches',
      valueBoolean: 'false',
    },
  ],
};

let server, request, responseBody;

Given('MPI service is up and running', async (): Promise<void> => {
  const response = await fetch(
    `${config.mpiProtocol}://${config.mpiHost}:${config.mpiPort}/auth`
  );
  expect(response.status).to.equal(200);
  server = app.listen(3003);
  request = supertest(server);
});

When('a $match search request is sent', async (): Promise<void> => {
  const response = await request
    .post('/fhir/Patient/$match')
    .send(validMatchParams)
    .set('Content-Type', 'application/fhir+json')
    .expect(200);

  responseBody = response.body;
});

Then('a success response is sent back', (): void => {
  expect(responseBody.body.status).to.equal('Success');
  server.close();
});

When('an invalid $match search request is sent', async (): Promise<void> => {
  const response = await request
    .post('/fhir/Patient/$match')
    .send(invalidMatchParams)
    .set('Content-Type', 'application/fhir+json')
    .expect(500);

  responseBody = response.body;
});

Then('an error response is sent back', (): void => {
  expect(responseBody.body.status).to.equal('Failed');
  server.close();
});