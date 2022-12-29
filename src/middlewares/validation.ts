import { RequestHandler } from 'express';
import { getConfig } from '../config/config';
import logger from '../logger';
import { buildOpenhimResponseObject, isHttpStatusOk, postData } from '../utils/utils';

const { fhirDatastoreProtocol, fhirDatastoreHost, fhirDatastorePort } = getConfig();

export const validationMiddleware: RequestHandler = async (req, res, next) => {
  logger.info('Validating Fhir Resources');

  const response = await postData(
    fhirDatastoreProtocol,
    fhirDatastoreHost,
    fhirDatastorePort,
    `/fhir/${req.body.resourceType}/$validate`,
    JSON.stringify(req.body),
    { 'Content-Type': 'application/fhir+json' }
  );

  let transactionStatus = 'Success';

  if (isHttpStatusOk(response.status)) {
    logger.info('Successfully validated bundle!');
    res.locals.validationResponse = {
      status: response.status,
      transactionStatus,
      body: response.body,
    };

    return next();
  } else {
    logger.error(`Error in validating: ${JSON.stringify(response.body)}!`);
    transactionStatus = 'Failed';

    const responseBody = buildOpenhimResponseObject(
      transactionStatus,
      response.status,
      response.body
    );

    res.set('Content-Type', 'application/openhim+json');
    res.status(response.status).send(responseBody);
  }
};
