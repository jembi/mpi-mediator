import moment from 'moment';
import fetch from 'node-fetch';

import { getConfig } from '../config/config';
import { OpenHimResponseObject, ResponseObject, Response } from '../types/response';

const config = getConfig();

export const postData = async (
  protocol: string,
  host: string,
  port: number | string,
  path: string,
  contentType: string,
  data: string
) : Promise<ResponseObject> => {
  let body: object = {};
  let status: number = 500;

  try {
    const response = await fetch(`${protocol}://${host}:${port}/${path}`, {
      headers: {
        'Content-Type': contentType
      },
      body: data,
      method: 'POST'
    });
    body = await response.json();
    status = response.status;
  } catch (err) {
    if (typeof err === 'string') {
      body = {error: err};
    } else if (err instanceof Error) {
      body = {error: err.message};
    }
    status = 500;
  }

  return {
    status, body
  };
};

export const buildOpenhimResponseObject = (
  openhimTransactionStatus: string,
  httpResponseStatusCode: number,
  responseBody: object,
  contentType: string = 'application/json'
) : OpenHimResponseObject => {
  const response : Response = {
    status: httpResponseStatusCode,
    headers: { 'content-type': contentType},
    body: responseBody,
    timestamp: moment().format()
  };

  return {
    'x-mediator-urn': config.mediatorUrn,
    status: openhimTransactionStatus,
    response
  };
};
