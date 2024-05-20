import { responseInterceptor } from 'http-proxy-middleware';
import { OnProxyReqCallback } from 'http-proxy-middleware/dist/types';
import logger from '../logger';
import { buildOpenhimResponseObject, isHttpStatusOk } from '../utils/utils';

/**
 * Intercepts http proxy middle responses and transforms them into
 * a openHIM compliant response
 */
export const openhimProxyResponseInterceptor = responseInterceptor(
  async (responseBuffer, proxyRes, _req, _res) => {
    const response = responseBuffer.toString('utf8'); // convert buffer to string
    const body = JSON.parse(response);
    const statusCode: number = proxyRes.statusCode || 500;
    let transactionStatus;

    if (isHttpStatusOk(statusCode)) {
      logger.info('Successfully proxied request!');
      transactionStatus = 'Successful';
    } else {
      logger.error(`Error in validating: ${JSON.stringify(body)}!`);
      transactionStatus = 'Failed';
    }

    const responseBody = buildOpenhimResponseObject(transactionStatus, statusCode, body);

    _res.setHeader('Content-Type', 'application/json+openhim');

    return JSON.stringify(responseBody);
  }
);

/**
 * Intercepts http proxy middle requests and stringify the body if it has been already parsed (using bodyParser)
 */
export const proxyRequestInterceptor: OnProxyReqCallback = (proxyReq, req) => {
  if (!req.body || !Object.keys(req.body).length) {
    return;
  }

  const writeBody = (bodyData: string) => {
    proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
    proxyReq.write(bodyData);
  };

  writeBody(JSON.stringify(req.body));
};
