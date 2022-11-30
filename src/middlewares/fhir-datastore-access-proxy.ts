import { Request, RequestHandler } from 'express';
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
 */
const filterFhirRequests = (pathname: string, req: Request): boolean => {
  return req.method === 'GET' && !!pathname.match(/^\/fhir\/[A-z]+(\/.+)?$/);
};

/**
 * Creates a request handler that will handle API interactions for other FHIR resources
 */
const createFhirAccessProxy = (): RequestHandler => {
  const {
    fhirDatastoreProtocol: protocol,
    fhirDatastoreHost: host,
    fhirDatastorePort: port,
    logLevel,
  } = getConfig();

  // Create a proxy to HAPI FHIR
  return createProxyMiddleware(filterFhirRequests, {
    target: new URL(`${protocol}://${host}:${port}`),
    logLevel,
    logProvider,
    onError(err, _req, _res) {
      logger.error(err);
    },
  });
};

export const fhirDatastoreAccessProxyMiddleware = createFhirAccessProxy();
