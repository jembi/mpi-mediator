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
const createSanteMpiAccessProxy = () => {
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

export const santeMpiAccessProxyMiddleware = createSanteMpiAccessProxy();
