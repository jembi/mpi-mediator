import format from 'date-fns/format';
import fetch from 'node-fetch';

import { getConfig } from '../config/config';
import logger from '../logger';
import {
  OpenHimResponseObject,
  ResponseObject,
  Response,
  MpiMediatorResponseObject,
} from '../types/response';
import { RequestDetails, Headers } from '../types/request';
import { Bundle, BundleEntry, Resource } from 'fhir/r3';

const config = getConfig();

export const isHttpStatusOk = (status: number) => status >= 200 && status < 300;

export const sendRequest = async (req: RequestDetails): Promise<ResponseObject> => {
  let body: object = {};
  let status = 200;

  try {
    const response = await fetch(`${req.protocol}://${req.host}:${req.port}${req.path}`, {
      headers: {
        'Content-Type': req.headers?.contentType ? req.headers.contentType : '',
        Authorization: req.headers?.authToken ? req.headers.authToken : '',
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
  headers: Headers
): Promise<ResponseObject> => {
  return sendRequest({
    method: 'GET',
    protocol,
    host,
    port,
    headers,
    path,
  });
};

export const postData = async (
  protocol: string,
  host: string,
  port: number | string,
  path: string,
  contentType: string,
  data: string,
  authToken?: string
): Promise<ResponseObject> => {
  return sendRequest({
    method: 'POST',
    protocol,
    host,
    port,
    path,
    headers: { authToken, contentType },
    data,
  });
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

  const patientEntry: BundleEntry | undefined = bundle.entry.find((val) => {
    if (val.resource?.resourceType === 'Patient') {
      return true;
    }
  });

  return patientEntry?.resource || null;
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
  tempPatientRef = '',
  clientRegistryPatientRef = ''
): Bundle => {
  let modifiedBundle = Object.assign({}, bundle);

  if (modifiedBundle.type === 'document') {
    logger.info('Converting document bundle to transaction bundle');
    modifiedBundle.type = 'transaction';
  }

  const newEntry = modifiedBundle.entry
    ?.filter((val) => val.resource?.resourceType !== 'Patient')
    .map((entry) => {
      return Object.assign({}, entry, {
        request: {
          method: 'PUT',
          url: `${entry.resource?.resourceType}/${entry.resource?.id}`,
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

export const createNewPatientRef = (patientId: string): string => {
  return `${config.mpiProtocol}://${config.mpiHost}:${config.mpiPort}/fhir/Patient/${patientId}`;
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
