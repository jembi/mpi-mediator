import { expect } from 'chai';
import sinon from 'sinon';
import nock from 'nock';
import { Kafka } from 'kafkajs';
import { asyncGoldenIdUpdater } from '../../src/routes/handlers/kafkaAsyncGoldenIdUpdater';
import { getConfig } from '../../src/config/config';
import logger from '../../src/logger';
import { resetMpiToken } from '../../src/utils/mpi';

const config = getConfig();

const { mpiProtocol, mpiHost, mpiPort } = config;
const mpiUrl = `${mpiProtocol}://${mpiHost}:${mpiPort}`;

const oAuthToken = {
  token_type: 'bearer',
  access_token: 'accessToken',
  refresh_token: 'refreshToken',
  expires_in: 3, // 3s
};

describe('asyncGoldenIdUpdater', () => {
  let sandbox: sinon.SinonSandbox;
  let mockConsumer: any;
  let mockProducer: any;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    mockConsumer = {
      connect: sandbox.stub(),
      subscribe: sandbox.stub(),
      run: sandbox.stub(),
    };
    mockProducer = {
      connect: sandbox.stub(),
      send: sandbox.stub(),
    };
    sandbox.stub(Kafka.prototype, 'consumer').returns(mockConsumer);
    sandbox.stub(Kafka.prototype, 'producer').returns(mockProducer);
  });

  afterEach(() => {
    sandbox.restore();
    nock.cleanAll();
    resetMpiToken();
  });

  it('should connect to Kafka consumer and producer', async () => {
    await asyncGoldenIdUpdater();
    expect(mockConsumer.connect.calledOnce).to.be.true;
    expect(mockProducer.connect.calledOnce).to.be.true;
  });

  it('should subscribe to the correct topic', async () => {
    const config = getConfig();
    await asyncGoldenIdUpdater();
    expect(
      mockConsumer.subscribe.calledWith({
        topic: config.kafkaJempiAuditTopic,
      })
    ).to.be.true;
  });

  it('should handle message correctly', async () => {
    const config = getConfig();
    const mockMessage = {
      value: JSON.stringify({
        event: 'Interaction -> update GoldenID',
        interactionID: 'xxx',
        goldenID: 'ggg',
      }),
    };
    const mockResource = {
      link: [],
    };

    nock(mpiUrl).post('/auth/oauth2_token').reply(200, oAuthToken);
    nock(mpiUrl).get('/fhir/Patient/xxx').reply(200, mockResource);

    await asyncGoldenIdUpdater();
    const promises = mockConsumer.run.yieldTo('eachMessage', { message: mockMessage });
    await promises[0];

    expect(mockProducer.send.calledOnce).to.be.true;

    expect(
      mockProducer.send.calledWith({
        topic: config.kafkaPatientTopic,
        messages: [
          {
            value: JSON.stringify({
              resource: {
                link: [
                  {
                    type: 'refer',
                    other: {
                      reference: `Patient/ggg`,
                    },
                  },
                ],
              },
            }),
          },
        ],
      })
    ).to.be.true;
  });

  it('should handle patient not found error correctly', async () => {
    const mockMessage = {
      value: JSON.stringify({
        event: 'Interaction -> update GoldenID',
        interactionID: 'xxx',
        goldenID: 'ggg',
      }),
    };
    const mockError = new Error('Test error');
    nock(mpiUrl).post(`/auth/oauth2_token`).reply(200, oAuthToken);
    nock(mpiUrl).get(`/fhir/Patient/xxx`).replyWithError(mockError);

    const loggerErrorStub = sandbox.stub(logger, 'error');

    await asyncGoldenIdUpdater();
    const promises = mockConsumer.run.yieldTo('eachMessage', { message: mockMessage });
    await promises[0];

    expect(loggerErrorStub.calledOnce).to.be.true;
    expect(loggerErrorStub.calledWith(`Patient with id xxx not found in MPI`)).to.be.true;
  });

  it('should handle producer error correctly', async () => {
    const mockMessage = {
      value: JSON.stringify({
        event: 'Interaction -> update GoldenID',
        interactionID: 'xxx',
        goldenID: 'ggg',
      }),
    };
    const mockResource = {
      link: [],
    };
    const mockError = new Error('Test error');
    nock(mpiUrl).post(`/auth/oauth2_token`).reply(200, oAuthToken);
    nock(mpiUrl).get('/fhir/Patient/xxx').reply(200, mockResource);
    mockProducer.send.throws(mockError);

    const loggerErrorStub = sandbox.stub(logger, 'error');

    await asyncGoldenIdUpdater();
    const promises = mockConsumer.run.yieldTo('eachMessage', { message: mockMessage });
    await promises[0];

    expect(loggerErrorStub.calledOnce).to.be.true;
    expect(loggerErrorStub.calledWith(`Error sending patient to 'patient' topic`, mockError))
      .to.be.true;
  });
});
