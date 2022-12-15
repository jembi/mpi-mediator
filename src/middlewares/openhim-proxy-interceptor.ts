import { responseInterceptor } from 'http-proxy-middleware';
import logger from '../logger';
import { buildOpenhimResponseObject } from '../utils/utils';

/**
 * Intercepts http proxy middle responses and transforms them into
 * a openHIM compliant response
 */
export const openhimProxyResponseInterceptor = responseInterceptor(
  async (responseBuffer, proxyRes, _req, _res) => {
    const response = responseBuffer.toString('utf8'); // convert buffer to string
    const body = JSON.parse(response);
    const statusCode = proxyRes.statusCode || 500;
    let transactionStatus;
    
    if (proxyRes.statusCode === 200) {
      logger.info('Successfully proxied request!');
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
  }
);
