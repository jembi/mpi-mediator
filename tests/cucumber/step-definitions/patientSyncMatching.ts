// @ts-nocheck
import { Given, When, Then, setDefaultTimeout } from 'cucumber';
import { expect } from 'chai';
import sinon from 'sinon';
import rewire from 'rewire';
import supertest from 'supertest';
import path from 'path';
import fetch from 'node-fetch';

import { getConfig } from '../../../src/config/config';
import * as KafkaFhir from '../../../src/utils/kafkaFhir';
import { getMpiAuthToken } from '../../../src/utils/mpi';

const app = rewire('../../../src/index').__get__('app');
const config = getConfig();

setDefaultTimeout(config.cucumberDefaultTimeout);

const bundle = require(path.resolve(__dirname, '..', 'data', 'bundle.json'));
const invalidPatientRefBundle = require(path.resolve(
  __dirname,
  '..',
  'data',
  'invalidPatientRefBundle.json'
));

let server: unknown, request: unknown, responseBody: unknown;

const sendToKafka = sinon.stub(KafkaFhir, 'sendToKafka');
sendToKafka.callsFake((_bundle, _topic) => {
  return null;
});

Given(
  'the fhir datastore, kafka and the client registry are up and running',
  async (): Promise<void> => {
    const fhirResponse = await fetch(
      `${config.fhirDatastoreProtocol}://${config.fhirDatastoreHost}:${config.fhirDatastorePort}`
    );
    expect(fhirResponse.status).to.equal(200);

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

When('a fhir bundle is send to the MPI mediator', async (): Promise<void> => {
  const response = await request
    .post('/fhir')
    .send(bundle)
    .set('content-type', 'application/fhir+json')
    .expect(200);

  responseBody = response.body;
});

When(
  'a fhir bundle with an invalid patient reference is send to the MPI mediator',
  async (): Promise<void> => {
    const response = await request
      .post('/fhir')
      .send(invalidPatientRefBundle)
      .set('content-type', 'application/fhir+json')
      .expect(400);

    responseBody = response.body;
  }
);

When(
  'a fhir bundle with a valid patient reference is send to the MPI mediator',
  async (): Promise<void> => {
    const response = await request
      .post('/fhir')
      .send(bundle)
      .set('content-type', 'application/fhir+json')
      .expect(200);

    responseBody = response.body;
  }
);

Then('a patient should be created on the client registry', async (): Promise<void> => {
  const auth = await getMpiAuthToken();

  const { response } = JSON.parse(responseBody.response.body).entry.find((entry) =>
    entry.response.location.startsWith('Patient')
  );

  const patientId = response.location.split('/')[1];

  const fhirPatient = await fetch(
    `${config.fhirDatastoreProtocol}://${config.fhirDatastoreHost}:${config.fhirDatastorePort}/fhir/Patient/${patientId}`,
    {
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
      },
      method: 'GET',
    }
  );

  const jsonPatient = await fhirPatient.json()

  const res = await fetch(
    jsonPatient.link[0].other.reference,
    {
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
      },
      method: 'GET',
    }
  );

  expect(res.status).to.be.equal(200);
});

Then(`it's clinical data should be stored in the fhir datastore`, async (): Promise<void> => {
  const auth = await getMpiAuthToken();
  const observationId = 'testObservation';

  const response = await fetch(
    `${config.fhirDatastoreProtocol}://${config.fhirDatastoreHost}:${config.fhirDatastorePort}/fhir/Observation/${observationId}`,
    {
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
      },
      method: 'GET',
    }
  );

  expect(response.status).to.be.equal(200);
  server.close();
});

Then('an error, indicating the patient does not exist, should be sent back', (): void => {
  expect(responseBody.status).to.equal('Failed');
  server.close();
});

Then(
  'a response, indicating the clinical data has been stored, should be sent back',
  (): void => {
    expect(responseBody.status).to.equal('Success');
    sendToKafka.restore();
    server.close();
  }
);
