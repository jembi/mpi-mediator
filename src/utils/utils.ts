import format from 'date-fns/format';
import fetch, { RequestInit } from 'node-fetch';

import { getConfig } from '../config/config';
import logger from '../logger';
import {
  OpenHimResponseObject,
  ResponseObject,
  Response,
  AuthHeader,
  MpiMediatorResponseObject,
} from '../types/response';
import { Bundle, Resource, Entry } from '../types/bundle';
import { RequestDetails } from '../types/request';

const config = getConfig();

export const sendRequest = async (req: RequestDetails): Promise<ResponseObject> => {
  let body: object = {};
  let status: number = 200;

  try {
    const response = await fetch(`${req.protocol}://${req.host}:${req.port}${req.path}`, {
      headers: {
        'Content-Type': req.contentType ? req.contentType : '',
        Authorization: req.authToken ? req.authToken : '',
      },
      body: req.data,
      method: req.method,
    });
    body = await response.json();
    status = response.status;
  } catch (err) {
    if (typeof err === 'string') {
      body = { error: err };
    } else if (err instanceof Error) {
      body = { error: err.message };
    }

    status = 500;
  }

  return {
    status,
    body,
  };
};

export const getData = async (
  protocol: string,
  host: string,
  port: number | string,
  path: string,
  headers?: HeadersInit
): Promise<ResponseObject> => {
  return sendRequest({
    method: 'GET',
    protocol,
    host,
    port,
    path,
  });
};

export const postData = async (
  protocol: string,
  host: string,
  port: number | string,
  path: string,
  contentType: string,
  data: string
): Promise<ResponseObject> => {
  return sendRequest({ method: 'POST', protocol, host, port, path, contentType, data });
};

export const buildOpenhimResponseObject = (
  openhimTransactionStatus: string,
  httpResponseStatusCode: number,
  responseBody: object,
  contentType = 'application/json'
): OpenHimResponseObject => {
  const response: Response = {
    status: httpResponseStatusCode,
    headers: { 'content-type': contentType },
    body: responseBody,
    timestamp: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSXXX"),
  };

  return {
    'x-mediator-urn': config.mediatorUrn,
    status: openhimTransactionStatus,
    response,
  };
};

export const extractPatientResource = (bundle: Bundle): Resource | null => {
  if (!bundle || !bundle.entry || !bundle.entry.length) {
    return null;
  }

  const patientEntry: Entry | undefined = bundle.entry.find((val, i) => {
    if (val.resource.resourceType === 'Patient') {
      return true;
    }
  });

  return patientEntry ? patientEntry.resource : null;
};

export const extractPatientId = (bundle: Bundle): string | null => {
  const patientRefs: string[] = Array.from(
    new Set(JSON.stringify(bundle).match(/Patient\/[^/^"]*/g))
  );

  if (!patientRefs.length) {
    return null;
  }
  const splitRef: string[] = patientRefs[0].split('/');

  return splitRef.length === 2 ? splitRef[1] : null;
};

/*
  This method modifies the bundle by replacing the temporary patient reference with the Client
  Registry's patient reference, after creating the patient resource in the Client Registry.
  It also adds the request property to the bundle entries. For bundles of type 'document'.
  The Patient resouce is also removed from the bundle. Only clinical data is stored in the Fhir Datastore
*/
export const modifyBundle = (
  bundle: Bundle,
  tempPatientRef: string = '',
  clientRegistryPatientRef: string = ''
): Bundle => {
  let modifiedBundle = Object.assign({}, bundle);

  if (modifiedBundle.type === 'document') {
    logger.info('Converting document bundle to transaction bundle');
    modifiedBundle.type = 'transaction';
  }

  const newEntry = modifiedBundle.entry
    .filter((val) => val.resource.resourceType !== 'Patient')
    .map((entry) => {
      return Object.assign({}, entry, {
        request: {
          method: 'PUT',
          url: `${entry.resource.resourceType}/${entry.resource.id}`,
        },
      });
    });
  modifiedBundle.entry = newEntry;

  if (tempPatientRef && clientRegistryPatientRef) {
    modifiedBundle = JSON.parse(
      JSON.stringify(modifiedBundle).replace(
        new RegExp(tempPatientRef, 'g'),
        clientRegistryPatientRef
      )
    );
  }

  return modifiedBundle;
};

export const createNewPatientRef = (body: object): string => {
  return `${config.clientRegistryProtocol}://${config.clientRegistryHost}:${
    config.clientRegistryPort
  }/fhir/Patient/${JSON.parse(JSON.stringify(body)).id}`;
};

export const createHandlerResponseObject = (
  transactionStatus: string,
  response: ResponseObject
): MpiMediatorResponseObject => {
  const responseBody = buildOpenhimResponseObject(
    transactionStatus,
    response.status,
    response.body
  );

  return {
    body: responseBody,
    status: response.status,
  };
};
