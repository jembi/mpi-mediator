import { Kafka, logLevel } from 'kafkajs';

import { getConfig } from '../../config/config';
import logger from '../../logger';
import { JempiAudit } from '../../types/jempiAudit';
import { fetchMpiResourceByRef } from '../../utils/mpi';
import { Patient } from 'fhir/r3';

export const asyncGoldenIdUpdater = async (): Promise<void> => {
  const config = getConfig();

  const kafka = new Kafka({
    logLevel: logLevel.ERROR,
    clientId: config.mpiKafkaClientId,
    brokers: config.kafkaBrokers.split(','),
  });

  const consumer = kafka.consumer({ groupId: 'mpi-mediator-golden-id' });
  const producer = kafka.producer();

  await consumer.connect();
  await consumer.subscribe({
    topic: config.kafkaJempiAuditTopic,
  });

  await producer.connect();

  logger.info('Kafka golden ID consumer started');

  await consumer.run({
    eachMessage: async ({ message }) => {
      logger.info('JeMPI audit received from queue');

      if (message.value === null) {
        logger.info('JeMPI audit message is null');

        return;
      }

      let audit: JempiAudit;

      try {
        audit = JSON.parse(message.value.toString());
      } catch (error) {
        logger.error('Error parsing JeMPI audit message', error);

        return;
      }

      if (
        audit.event.startsWith('Interaction -> update GoldenID') ||
        audit.event.startsWith('Interaction -> new GoldenID')
      ) {
        logger.info(
          `Received JeMPI audit for a GoldenID change: Updating patientId ${audit.interactionID} with goldenId ${audit.goldenID}`
        );

        try {
          const resource = await fetchMpiResourceByRef<Patient>(
            `Patient/${audit.interactionID}`
          );

          if (!resource) {
            logger.error(`Patient with id ${audit.interactionID} not found in MPI`);

            return;
          }

          if (!resource.link) {
            resource.link = [];
          }

          const goldenIdLink = resource.link.find((link) => link.type === 'refer');

          if (goldenIdLink) {
            goldenIdLink.other = {
              reference: `Patient/${audit.goldenID}`,
            };
          } else {
            resource.link.push({
              type: 'refer',
              other: {
                reference: `Patient/${audit.goldenID}`,
              },
            });
          }

          await producer.send({
            topic: config.kafkaPatientTopic,
            messages: [
              {
                value: JSON.stringify({
                  resource,
                }),
              },
            ],
          });
        } catch (err) {
          logger.error(`Error sending patient to '${config.kafkaPatientTopic}' topic`, err);
        }
      }
    },
  });
};
