// @ts-nocheck
import { Given, When, Then, setDefaultTimeout } from 'cucumber';
import { expect } from 'chai';
import rewire from 'rewire';
import supertest from 'supertest';
import fetch from 'node-fetch';

import { getConfig } from '../../../src/config/config';

const app = rewire('../../../src/index').__get__('app');
const config = getConfig();

let server: any, request: any, responseBody: any;

setDefaultTimeout(config.cucumberDefaultTimeout);

Given('MPI client registry service is up and running', async (): Promise<void> => {
  const response = await fetch(
    `${config.mpiProtocol}://${config.mpiHost}:${config.mpiPort}/auth`
  );
  expect(response.status).to.equal(200);
  server = app.listen(3003);
  request = supertest(server);
});

When('a post request without body was sent to get patients', async (): Promise<void> => {
  const response = await request
    .post('/fhir/Patient/$match')
    .set('Content-Type', 'application/fhir+json')
    .expect(400);

  responseBody = response.body;
});

Then('we should get an error response', (): void => {
  expect(
    responseBody.response.body.error,
    `Invalid Content! Type should be "${config.contentType}" and Length should be greater than 0"`
  );
  server.close();
});

When('a post request with body was sent to get patients', async (): Promise<void> => {
  const response = await request
    .post('/fhir/Patient/$match')
    .send({
      resourceType: 'Parameters',
      id: 'example',
      parameter: [
        {
          name: 'resource',
          resource: {
            resourceType: 'Patient',
            text: {
              div: '<div xmlns="http://www.w3.org/1999/xhtml">Patient</div>',
              status: 'generated',
            },
            name: [
              {
                family: 'Smith',
                given: ['John'],
              },
            ],
          },
        },
        {
          name: 'count',
          valueInteger: 3,
        },
        {
          name: 'onlyCertainMatches',
          valueBoolean: false,
        },
      ],
    })
    .set('Content-Type', 'application/fhir+json')
    .expect(200);

  responseBody = response.body;
});

Then('a response should be sent back', (): void => {
  expect(JSON.parse(responseBody.response.body).id).not.empty;
  server.close();
});
