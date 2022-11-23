import moment from 'moment';
import fetch, { RequestInit } from 'node-fetch';

import { getConfig } from '../config/config';
import { OpenHimResponseObject, ResponseObject, Response } from '../types/response';

const config = getConfig();

export const sendRequest = async (
  method: string,
  protocol: string,
  host: string,
  port: number | string,
  path: string,
  headers: HeadersInit | undefined = { 'Content-Type': 'application/fhir+json' },
  data?: string
) : Promise<ResponseObject> => {
  let body: object = {};
  let status: number = 500;

  try {
    const options = {
      headers,
      method
    } as RequestInit;
    if (method === 'POST') {
      options.body = data;
    }
    const url = new URL(`${protocol}://${host}:${port}/${path}`);
    const response = await fetch(url, options);
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

export const getData = async (
  protocol: string,
  host: string,
  port: number | string,
  path: string,
  headers?: HeadersInit,
) : Promise<ResponseObject> => {
  return sendRequest('GET', protocol, host, port, path, headers);
};

export const postData = async (
  protocol: string,
  host: string,
  port: number | string,
  path: string,
  contentType: string,
  data: string
) : Promise<ResponseObject> => {
  const headers = { 'Content-Type': contentType };
  return sendRequest('POST', protocol, host, port, path, headers, data);
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
