import format from 'date-fns/format';
import fetch, { HeaderInit, HeadersInit } from 'node-fetch';

import { getConfig } from '../config/config';
import logger from '../logger';
import {
  OpenHimResponseObject,
  ResponseObject,
  Response,
  MpiMediatorResponseObject,
  MpiTransformResult,
} from '../types/response';
import { RequestDetails } from '../types/request';
import { Bundle, BundleEntry, BundleLink, FhirResource, Resource } from 'fhir/r3';

const config = getConfig();

export const isHttpStatusOk = (status: number) => status >= 200 && status < 300;

export const sendRequest = async ({
  protocol,
  host,
  port,
  path,
  headers,
  data,
  method,
}: RequestDetails): Promise<ResponseObject> => {
  let body: object = {};
  let status = 200;

  try {
    const response = await fetch(`${protocol}://${host}:${port}${path}`, {
      headers,
      body: data,
      method: method,
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
  headers: HeadersInit
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
  data: string,
  headers: HeaderInit = { 'Content-Type': 'application/fhir+json' }
): Promise<ResponseObject> => {
  return sendRequest({
    method: 'POST',
    protocol,
    host,
    port,
    path,
    headers,
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
    headers: { 'Content-Type': contentType },
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

/**
 * This method removes the patient's extension and managing organization. The Client registry only stores Patient resources. Extensions and Managing Organization
 * references will result in validation errors.
 * The function returns a tranformed patient, extension and managing organization.
 */
export const transformPatientResourceForMPI = (patient: Resource): MpiTransformResult => {
  const transformedPatient = JSON.parse(JSON.stringify(patient));

  const extension = transformedPatient.extension;
  const managingOrganization = transformedPatient.managingOrganization;

  delete transformedPatient.extension;
  delete transformedPatient.managingOrganization;

  return {
    patient: transformedPatient,
    managingOrganization,
    extension,
  };
};

export const createNewPatientRef = (patientId: string): string => {
  if (config.mpiProxyUrl) {
    return `${config.mpiProxyUrl}/fhir/Patient/${patientId}`;
  }

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

export const mergeBundles = async (
  fhirRequests: (Bundle<FhirResource> | null)[],
  type = 'searchset'
) => {
  const fhirBundles = fhirRequests.filter((bundle) => !!bundle) as Bundle[];
  // Combine all bundles into a single one
  const bundle = fhirBundles.reduce(
    (acc, curr) => {
      // Concat entries
      if (Array.isArray(curr.entry)) {
        acc.entry = (acc.entry || []).concat(curr.entry);
        acc.total = (acc.total || 0) + curr.entry.length;
      }

      // Concat links
      if (curr.link && Array.isArray(curr.link)) {
        acc.link = (acc.link || []).concat(
          curr.link.map(({ url }) => {
            return {
              relation: 'subsection',
              url,
            } as BundleLink;
          })
        );
      }

      return acc;
    },
    {
      resourceType: 'Bundle',
      meta: {
        lastUpdated: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      },
      type,
      total: 0,
      link: [],
      entry: [],
    } as Bundle
  );

  return bundle;
};
