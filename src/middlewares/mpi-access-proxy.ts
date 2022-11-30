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
 * Helper function to filter out the requests that needs to be proxied to the MPI
 */
const filterMpiRequests = (pathname: string, req: Request): boolean => {
  return req.method === 'POST' && !!pathname.match(/^\/fhir\/Patient\/\$match/i);
};

/**
 * Creates a request handler that will handle API interactions for FHIR Patients
 */
const createMpiAccessProxy = (): RequestHandler => {
  const config = getConfig();
  const { mpiProtocol: protocol, mpiHost: host, mpiPort: port } = config;

  // Create a proxy to the MPI
  const proxyMiddleWare = createProxyMiddleware(filterMpiRequests, {
    target: new URL(`${protocol}://${host}:${port}`),
    logLevel: 'debug',
    logProvider,
    onError(err, _req, _res) {
      logger.error(err);
    },
  });

  return proxyMiddleWare;
};

export const mpiAccessProxyMiddleware = createMpiAccessProxy();
