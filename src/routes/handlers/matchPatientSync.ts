import logger from '../../logger';
import { Bundle } from '../../types/bundle';
import { HandlerResponseObect } from '../../types/response';
import { processBundle } from '../../utils/kafkaFhir';

export const matchSyncHandler = async (bundle: Bundle): Promise<HandlerResponseObect> => {
  logger.info('Fhir bundle recieved for synchronous matching of the patient!');

  const handlerResponse: HandlerResponseObect = await processBundle(bundle);

  return handlerResponse;
};
