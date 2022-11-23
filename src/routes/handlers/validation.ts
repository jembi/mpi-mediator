import { buildOpenhimResponseObject, postData } from '../utils';
import { getConfig } from '../../config/config';
import logger from '../../logger';
import { Bundle } from '../../types/bundle';
import { MpiMediatorResponseObject } from '../../types/response';

const config = getConfig();

export const validate = async (
  bundle: Bundle
): Promise<MpiMediatorResponseObject> => {
  logger.info('Validating Fhir Resources');

  const response = await postData(
    config.fhirDatastoreProtocol,
    config.fhirDatastoreHost,
    config.fhirDatastorePort,
    'fhir/Bundle/$validate',
    'application/fhir+json',
    JSON.stringify(bundle)
  );

  let transactionStatus: string;

  if (response.status === 200) {
    logger.info('Successfully validated bundle!');
    transactionStatus = 'Success';
  } else {
    logger.error(`Error in validating: ${JSON.stringify(response.body)}!`);
    transactionStatus = 'Failed';
  }

  const responseBody = buildOpenhimResponseObject(
    transactionStatus,
    response.status,
    response.body
  );

  return {
    body: responseBody,
    status: response.status,
  };
};
