import { RequestHandler } from 'express';
import { getConfig } from '../config/config';
import logger from '../logger';
import { ResponseObject } from '../types/response';
import { buildOpenhimResponseObject, isHttpStatusOk, postData } from '../utils/utils';

const {
  fhirDatastoreProtocol,
  fhirDatastoreHost,
  fhirDatastorePort,
  contentType,
  disableValidation,
} = getConfig();

export const validationMiddleware: RequestHandler = async (req, res, next) => {
  logger.info('Validating Fhir Resources');

  let response: ResponseObject;
  let transactionStatus: string;

  if (req.headers['content-type'] != contentType || req.headers['content-length'] == '0') {
    response = {
      body: {
        error: `Invalid Content! Type should be "${contentType}" and Length should be greater than 0"`,
      },
      status: 400,
    };
  } else if (disableValidation) {
    return next();
  } else {
    response = await postData(
      fhirDatastoreProtocol,
      fhirDatastoreHost,
      fhirDatastorePort,
      `/fhir/${req.body.resourceType}/$validate`,
      JSON.stringify(req.body),
      { 'Content-Type': 'application/fhir+json' }
    );

    transactionStatus = 'Success';

    if (isHttpStatusOk(response.status)) {
      logger.info('Successfully validated bundle!');
      res.locals.validationResponse = {
        status: response.status,
        transactionStatus,
        body: response.body,
      };

      return next();
    }
  }

  logger.error(`Error in validating: ${JSON.stringify(response.body)}!`);

  transactionStatus = 'Failed';

  const responseBody = buildOpenhimResponseObject(
    transactionStatus,
    response.status,
    response.body
  );

  res.set('Content-Type', 'application/json+openhim');
  res.status(response.status).send(responseBody);
};
