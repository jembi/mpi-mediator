import { Bundle } from 'fhir/r3';
import { getConfig } from '../../config/config';
import logger from '../../logger';
import { MpiMediatorResponseObject } from '../../types/response';
import { getMpiAuthToken } from '../../utils/mpi';
import {
  getData,
  isHttpStatusOk,
  createNewPatientRef,
  patientProjector,
  createHandlerResponseObject,
} from '../../utils/utils';
import { Patient } from 'fhir/r3';

const {
  fhirDatastoreProtocol: fhirProtocol,
  fhirDatastoreHost: fhirHost,
  fhirDatastorePort: fhirPort,
  mpiProtocol: mpiProtocol,
  mpiHost: mpiHost,
  mpiPort: mpiPort,
  mpiAuthEnabled,
} = getConfig();

export const fetchPatientByQuery = async (
  query: object
): Promise<MpiMediatorResponseObject> => {
  const params = Object.entries(query);
  let combinedParams = '';

  if (params.length > 0) {
    combinedParams = params
      .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
      .join('&');
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/fhir+json',
  };

  if (mpiAuthEnabled) {
    const token = await getMpiAuthToken();

    headers['Authorization'] = `Bearer ${token.accessToken}`;
  }

  const mpiResponse = await getData(
    mpiProtocol,
    mpiHost,
    mpiPort,
    `/fhir/Patient?${combinedParams}`,
    headers
  );

  const promises: any[] = [];

  if (isHttpStatusOk(mpiResponse.status)) {
    const bundle = mpiResponse.body as Bundle;

    logger.debug(`Adding patient link FHIR store`);

    addPatientLinks(promises, bundle);
  } else {
    return createHandlerResponseObject('Failed', mpiResponse);
  }

  try {
    const entries = await Promise.all(promises);

    return createHandlerResponseObject('Successful', {
      status: 200,
      body: {
        resourceType: 'Bundle',
        id: combinedParams,
        type: 'searchset',
        total: entries.length,
        entries: entries,
      },
    });
  } catch (err) {
    const status = (err as any).status || 500;
    const body = (err as any).body || {};

    logger.error('Failed to retrieve patient ', body);

    return createHandlerResponseObject('Failed', { status, body });
  }
};

export const fetchPatientById = async (
  requestedId: string,
  projection: string
): Promise<MpiMediatorResponseObject> => {
  const fhirResponse = await getData(
    fhirProtocol,
    fhirHost,
    fhirPort,
    `/fhir/Patient/${requestedId}`,
    {}
  );

  let upstreamId = requestedId;

  if (fhirResponse.status === 200) {
    const patient = fhirResponse.body as Patient;
    const interactionId =
      patient.link && patient.link[0]?.other.reference?.match(/Patient\/([^/]+)/)?.[1];

    if (interactionId) {
      upstreamId = interactionId;
      logger.debug(`Swapping source ID ${requestedId} for interaction ID ${upstreamId}`);
    }
  } else {
    return createHandlerResponseObject('Failed', fhirResponse);
  }

  logger.debug(`Fetching patient ${upstreamId} from MPI`);

  const headers: HeadersInit = {
    'Content-Type': 'application/fhir+json',
  };

  if (mpiAuthEnabled) {
    const token = await getMpiAuthToken();

    headers['Authorization'] = `Bearer ${token.accessToken}`;
  }

  const mpiResponse = await getData(
    mpiProtocol,
    mpiHost,
    mpiPort,
    `/fhir/links/Patient/${upstreamId}`,
    headers
  );

  let transactionStatus = 'Successful';

  // Map the upstreamId to the requestedId
  if (mpiResponse.status === 200) {
    const patient = mpiResponse.body as Patient;

    patient.id = requestedId;

    if (projection === 'partial') mpiResponse.body = patientProjector(patient);

    logger.debug(
      `Mapped upstream ID ${upstreamId} to requested ID ${requestedId} in response body`
    );
  } else {
    transactionStatus = 'Failed';
  }

  return createHandlerResponseObject(transactionStatus, mpiResponse);
};

const addPatientLinks = (promises: any[], bundle: Bundle): void => {
  bundle.entry?.forEach((patient, index) => {
    const promise = new Promise(async (resolve, reject) => {
      const mpiLinksResponse = await getData(
        mpiProtocol,
        mpiHost,
        mpiPort,
        `/fhir/Patient/${encodeURIComponent(patient.resource?.id || '')}`,
        {}
      );

      if (isHttpStatusOk(mpiLinksResponse.status)) {
        const patient = mpiLinksResponse.body as Patient;
        const links =
          patient.link?.map((link) =>
            createNewPatientRef(link.other.reference?.split('/').pop() || '')
          ) || [];

        const fhirResponse = await getData(
          fhirProtocol,
          fhirHost,
          fhirPort,
          `/fhir/Patient?link=${encodeURIComponent(links.join(','))}`,
          {}
        );

        if (!isHttpStatusOk(fhirResponse.status)) {
          reject(fhirResponse);
        }

        const fhirBundle = fhirResponse.body as Bundle;

        if (bundle.entry && bundle.entry[index] && fhirBundle.entry) {
          const links = fhirBundle.entry.map((entry) => {
            return {
              type: 'refer',
              other: { reference: `Patient/${entry?.resource?.id || ''}` },
            };
          });
          resolve({
            fullUrl: fhirBundle.entry[index].fullUrl,
            resource: { ...bundle.entry[index].resource, link: links },
            request: fhirBundle.entry[index].request,
          });
        }
      } else {
        reject(mpiLinksResponse);
      }
    });

    promises.push(promise);
  });
};
