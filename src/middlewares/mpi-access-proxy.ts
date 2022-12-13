import { Request, RequestHandler } from 'express';
import { createProxyMiddleware, responseInterceptor } from 'http-proxy-middleware';
import qs from 'qs';
import { getConfig } from '../config/config';
import logger from '../logger';
import { buildOpenhimResponseObject } from '../utils/utils';

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
  const { mpiProtocol: protocol, mpiHost: host, mpiPort: port, logLevel } = getConfig();

  // Create a proxy to the MPI
  return createProxyMiddleware(filterMpiRequests, {
    target: new URL(`${protocol}://${host}:${port}`),
    logLevel,
    logProvider,
    pathRewrite(_path, req) {
      // Re-compute the path, since http-proxy-middleware relies on req.originalUrl
      return `${req.path}?${qs.stringify(req.query)}`;
    },
    onError(err, _req, _res) {
      logger.error(err);
    },
    /**
     * Intercept response and build a openHIM response
     **/
    selfHandleResponse: true,
    onProxyRes: responseInterceptor(async (responseBuffer, proxyRes, _req, _res) => {
      const response = responseBuffer.toString('utf8'); // convert buffer to string
      const body = JSON.parse(response);
      const statusCode = proxyRes.statusCode || 500;
      let transactionStatus;
      if (proxyRes.statusCode === 200) {
        logger.info('Successful proxied request!');
        transactionStatus = 'Success';
      } else {
        logger.error(`Error in validating: ${JSON.stringify(body)}!`);
        transactionStatus = 'Failed';
      }

      const responseBody = buildOpenhimResponseObject(transactionStatus, statusCode, body);

      return JSON.stringify({
        body: responseBody,
        status: statusCode,
      });
    }),
  });
};

export const mpiAccessProxyMiddleware = createMpiAccessProxy();
