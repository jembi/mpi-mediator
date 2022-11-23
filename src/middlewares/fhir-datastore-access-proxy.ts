import { Request } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { getConfig } from '../config/config';
import logger from '../logger';

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
const createFhirAccessProxy = () => {
  const config = getConfig();
  const {
    fhirDatastoreProtocol: protocol,
    fhirDatastoreHost: host,
    fhirDatastorePort: port,
  } = config;

  // Create a proxy to HAPI FHIR
  const target = new URL(`${protocol}://${host}:${port}`);
  const proxyMiddleWare = createProxyMiddleware(filterFhirRequests, {
    target,
    logLevel: 'debug',
    logProvider,
    onError(err, _req, _res) {
      logger.error(err);
    },
  });

  return proxyMiddleWare;
};

export const fhirDatastoreAccessProxyMiddleware = createFhirAccessProxy();
