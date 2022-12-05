import { Kafka, logLevel } from 'kafkajs';

import { getConfig } from '../config/config';
import logger from '../logger';
import { Bundle } from '../types/bundle';
import { MpiMediatorResponseObject } from '../types/response';
import { processBundle, sendToKafka } from '../utils/kafkaFhir';

const config = getConfig();

const kafka = new Kafka({
  logLevel: logLevel.ERROR,
  clientId: config.mpiKafkaClientId,
  brokers: config.kafkaBrokers.split(','),
});

const consumer = kafka.consumer({ groupId: 'mpi-mediator' });

export const asyncPatientMatchHandler = async (): Promise<void> => {
  await consumer.connect();
  await consumer.subscribe({
    topic: config.kafkaAsyncBundleTopic,
    fromBeginning: true,
  });

  logger.info('Kafka consumer started');

  await consumer.run({
    eachMessage: async ({ message }) => {
      logger.info('Fhir bundle received from queue');

      consumer.pause([{ topic: config.kafkaAsyncBundleTopic }]);
      const bundleString: string | undefined = message.value?.toString();
      let bundle: Bundle;

      if (!bundleString) {
        logger.error('Invalid Fhir bundle received from Kafka');
        consumer.resume([{ topic: config.kafkaAsyncBundleTopic }]);
        return;
      } else {
        bundle = JSON.parse(bundleString);
      }

      const processingResult: MpiMediatorResponseObject = await processBundle(bundle);

      if (processingResult.body.status === 'Failed') {
        sendToKafka(bundle, config.kafkaErrorTopic);
      }
      consumer.resume([{ topic: config.kafkaAsyncBundleTopic }]);
    },
  });
};
