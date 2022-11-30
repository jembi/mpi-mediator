import { RequestHandler } from 'express';
import { getConfig } from '../config/config';
import logger from '../logger';
import { buildOpenhimResponseObject } from '../routes/utils';
import { OAuth2Error } from '../utils/client-oauth2';
import { getMpiAuthToken } from '../utils/mpi';

/**
 * Express middleware in order to authenticate requests proxied to the MPI
 */
export const mpiAuthMiddleware: RequestHandler = async (req, res, next) => {
  try {
    const config = getConfig();
    if (config.mpiAuthEnabled) {
      const token = await getMpiAuthToken();
      req.headers['authorization'] = `Bearer ${token.accessToken}`;
    }
    next();
  } catch (e) {
    const error = e as OAuth2Error;
    logger.error(e, 'Unable to fetch OAuth2 access token and set auth header');
    const status = error.status || 500;
    const body = buildOpenhimResponseObject(status.toString(), status, error);
    res.status(status).send(body);
  }
};
