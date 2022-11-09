import { Request, RequestHandler } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

import logger from '../../logger';
import { buildOpenhimResponseObject } from '../../routes/utils';
import { ClientOAuth2, OAuth2Error, OAuth2Token } from '../../utils/client-oauth2';
import { getConfig } from '../../config/config';

// Singleton instance of SanteMPI Token stored in memory
export let santeMpiToken: OAuth2Token | null = null;

/**
 * Returns an instance of SanteMPI token, it does renew the token when expired.
 * @returns {Promise<OAuth2Token>}
 */
export const getSanteMpiAuthToken = async (): Promise<OAuth2Token> => {
  const config = getConfig();
  const {
    santeMpiProtocol,
    santeMpiHost,
    santeMpiPort,
    santeMpiClientId,
    santeMpiClientSecret,
  } = config;
  if (!santeMpiToken) {
    const santeMpiApiUrl = new URL(
      `${santeMpiProtocol}://${santeMpiHost}:${santeMpiPort}`
    );
    const santeMpiAuth = new ClientOAuth2({
      clientId: santeMpiClientId,
      clientSecret: santeMpiClientSecret,
      accessTokenUri: `${santeMpiApiUrl}auth/oauth2_token`,
      scopes: ['*'],
    });

    santeMpiToken = await santeMpiAuth.getToken();
  } else if (santeMpiToken.expired()) {
    santeMpiToken = await santeMpiToken.refresh();
  }
  return santeMpiToken;
};

/**
 * Express middleware in order to authenticate requests proxied to SanteMPI
 * @param {Request} req
 * @param {Response} res
 * @param {Function} next
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

const logProvider = () => {
  return {
    log: logger.debug.bind(logger),
    debug: logger.debug.bind(logger),
    info: logger.info.bind(logger),
    warn: logger.warn.bind(logger),
    error: logger.error.bind(logger),
  };
};

/**
 * Helper function to filter out the requests that needs to be proxied to SanteMPI
 * @param {String} pathname
 * @param {Request} req
 * @returns {Boolean}
 */
const filterSanteMpiRequests = (pathname: string, req: Request) => {
  return (
    req.method === 'POST' && !!pathname.match(/^\/fhir\/Patient\/\$match/i)
  );
};

/**
 * Creates a request handler that will handle API interactions for FHIR Patients
 * @returns {RequestHandler}
 */
export const createSanteMpiAccessProxy = () => {
  const config = getConfig();
  const {
    santeMpiProtocol: protocol,
    santeMpiHost: host,
    santeMpiPort: port,
  } = config;

  // Create a proxy to SanteMPIssss
  const target = new URL(`${protocol}://${host}:${port}`);
  const proxyMiddleWare = createProxyMiddleware(filterSanteMpiRequests, {
    target,
    logLevel: 'debug',
    logProvider,
    onError(err, _req, _res) {
      logger.error(err);
    },
  });

  return proxyMiddleWare;
};

/**
 * Helper function to filter out the requests that needs to be proxied to HAPI FHIR
 * @param {String} pathname
 * @param {Request} req
 * @returns {Boolean}
 */
const filterFhirRequests = (pathname: string, req: Request) => {
  const config = getConfig();
  return (
    req.method === 'GET' &&
    !!pathname.match(`^/fhir/(${config.accessProxyResources})(/.+)?`)
  );
};

/**
 * Creates a request handler that will handle API interactions for other FHIR resources
 * @returns {RequestHandler}
 */
export const createFhirAccessProxy = () => {
  const config = getConfig();
  const {
    fhirDatastoreProtocol: protocol,
    fhirDatastoreHost: host,
    fhirDatastorePort: port,
    logLevel,
  } = config;

  // Create a proxy to HAPI FHIR
  const target = new URL(`${protocol}://${host}:${port}`);
  const proxyMiddleWare = createProxyMiddleware(filterFhirRequests, {
    target,
    logLevel,
    logProvider,
    onProxyRes(proxyRes, req, res) {
      // @todo : Request SanteMPI MDM whenever $mdm query param is provided 
    },
  });

  return proxyMiddleWare;
};
