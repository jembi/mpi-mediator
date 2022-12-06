import logger from '../../logger';
import { getConfig } from '../../config/config';
import { Bundle } from '../../types/bundle';

import { MpiMediatorResponseObject } from '../../types/response';
import { validate } from './validation';
import { sendToKafka } from '../../utils/kafkaFhir';
import { createHandlerResponseObject } from '../../utils/utils';

const config = getConfig();

export const matchAsyncHandler = async (
  bundle: Bundle
): Promise<MpiMediatorResponseObject> => {
  logger.info('Fhir bundle received for asynchronous matching of the patient!');

  const validateResponse = await validate(bundle);

  if (validateResponse.status !== 200) {
    return validateResponse;
  }

  const kafkaError = await sendToKafka(bundle, config.kafkaAsyncBundleTopic);

  if (kafkaError) {
    return createHandlerResponseObject('Failed', {
      body: {
        error: kafkaError.message,
      },
      status: 500,
    });
  }

  return createHandlerResponseObject('Success', {
    status: 204,
    body: {},
  });
};
