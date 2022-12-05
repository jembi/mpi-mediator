import logger from '../../logger';
import { Bundle } from '../../types/bundle';
import { MpiMediatorResponseObject } from '../../types/response';
import { processBundle } from '../../utils/kafkaFhir';

export const matchSyncHandler = async (bundle: Bundle): Promise<MpiMediatorResponseObject> => {
  logger.info('Fhir bundle recieved for synchronous matching of the patient!');

  const handlerResponse: MpiMediatorResponseObject = await processBundle(bundle);

  return handlerResponse;
};
