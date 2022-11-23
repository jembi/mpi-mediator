import { RequestHandler } from 'express';
import logger from '../logger';
import { buildOpenhimResponseObject } from '../routes/utils';
import { OAuth2Error } from '../utils/client-oauth2';
import { getSanteMpiAuthToken } from '../utils/sante-mpi';

/**
 * Express middleware in order to authenticate requests proxied to SanteMPI
 */
 export const santeMpiAuthMiddleware: RequestHandler = async (
  req,
  res,
  next
) => {
  try {
    const token = await getSanteMpiAuthToken();
    req.headers['authorization'] = `Bearer ${token.accessToken}`;
    next();
  } catch (e) {
    const error = e as OAuth2Error;
    logger.error(e, 'Unable to fetch OAuth2 access token and set auth header');
    const status = error.status || 500;
    const body = buildOpenhimResponseObject(status.toString(), status, error);
    res.status(status).send(body);
  }
};
