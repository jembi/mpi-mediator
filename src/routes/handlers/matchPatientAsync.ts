import { Bundle } from 'fhir/r3';
import format from 'date-fns/format';

import logger from '../../logger';
import { getConfig } from '../../config/config';
import { MpiMediatorResponseObject, Orchestration } from '../../types/response';
import { sendToKafka } from '../../utils/kafkaFhir';
import { createHandlerResponseObject } from '../../utils/utils';

const config = getConfig();

export const matchAsyncHandler = async (
  bundle: Bundle
): Promise<MpiMediatorResponseObject> => {
  logger.info('Fhir bundle received for asynchronous matching of the patient!');

  const orchestration: Orchestration = {
    name: 'Sending to message bus - kafka',
    request: {
      host: config.kafkaBrokers,
      timestamp: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSXXX"),
    },
    response: {
      status: 200,
      body: JSON.stringify({ success: true }),
      timestamp: '',
      headers: { 'Content-Type': 'application/fhir+json' },
    },
  };

  const kafkaError = await sendToKafka(bundle, config.kafkaAsyncBundleTopic);

  orchestration.response.timestamp = format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSXXX");

  if (kafkaError) {
    logger.error(`Error in sending bundle to Kafka patient topic: ${kafkaError.message}`);

    orchestration.response.status = 500;
    orchestration.response.body = JSON.stringify(kafkaError);

    return createHandlerResponseObject(
      'Failed',
      {
        body: {
          error: kafkaError.message,
        },
        status: 500,
      },
      [orchestration]
    );
  }

  logger.info('Fhir bundle successfully sent to Kafka');

  return createHandlerResponseObject(
    'Success',
    {
      status: 204,
      body: {},
    },
    [orchestration]
  );
};
