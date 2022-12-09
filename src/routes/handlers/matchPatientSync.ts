import { Bundle } from 'fhir/r3';
import logger from '../../logger';
import { MpiMediatorResponseObject } from '../../types/response';
import { processBundle } from '../../utils/kafkaFhir';

export const matchSyncHandler = async (bundle: Bundle): Promise<MpiMediatorResponseObject> => {
  logger.info('Fhir bundle received for synchronous matching of the patient!');

  const handlerResponse: MpiMediatorResponseObject = await processBundle(bundle);

  return handlerResponse;
};
