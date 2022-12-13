import { Bundle } from 'fhir/r3';
import logger from '../../logger';
import { MpiMediatorResponseObject } from '../../types/response';
import { processBundle } from '../../utils/kafkaFhir';
import { validate } from './validation';

export const matchSyncHandler = async (bundle: Bundle): Promise<MpiMediatorResponseObject> => {
  logger.info('Fhir bundle received for synchronous matching of the patient!');

  const validateResponse = await validate(bundle);

  if (validateResponse.status !== 200) {
    return validateResponse;
  }

  const handlerResponse: MpiMediatorResponseObject = await processBundle(bundle);

  return handlerResponse;
};
