import { buildOpenhimResponseObject, sendRequest } from '../utils';
import { getConfig } from "../../config/config";
import logger from "../../logger";
import { Bundle } from "../../types/bundle";
import { ValidateResponseObect } from '../../types/response';
import {  RequestDetails } from '../../types/request';

const config = getConfig();

export const validate = async (bundle: Bundle) : Promise<ValidateResponseObect> => {
  logger.info('Validating Fhir Resources');

  const reqDetails : RequestDetails = {
    protocol: config.fhirDatastoreProtocol,
    host: config.fhirDatastoreHost,
    port: config.fhirDatastorePort,
    path: '/fhir/Bundle/$validate',
    contentType: 'application/fhir+json',
    method: 'POST',
    data: JSON.stringify(bundle)
  }

  const response = await sendRequest(reqDetails);

  let transactionStatus : string;

  if (response.status === 200) {
    logger.info('Successfully validated bundle!')
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
    status: response.status
  };
};
