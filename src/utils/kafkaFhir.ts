import { Kafka, logLevel } from 'kafkajs';

import { Bundle, BundleEntry, Patient } from 'fhir/r3';
import { getConfig } from '../config/config';
import { RequestDetails } from '../types/request';
import { MpiMediatorResponseObject, ResponseObject } from '../types/response';
import {
  createHandlerResponseObject,
  extractPatientEntries,
  isHttpStatusOk,
  modifyBundle,
  postData,
  restorePatientResource,
  sendRequest,
  transformPatientResourceForMPI,
} from './utils';
import logger from '../logger';
import { getMpiAuthToken } from './mpi';
import { OAuth2Token } from './client-oauth2';
import { NewPatientMap } from '../types/newPatientMap';

const config = getConfig();

const kafka = new Kafka({
  logLevel: logLevel.ERROR,
  clientId: config.mpiKafkaClientId,
  brokers: config.kafkaBrokers.split(','),
});
const producer = kafka.producer();

export const sendToKafka = async (bundle: Bundle, topic: string): Promise<Error | null> => {
  try {
    await producer.connect();
    await producer.send({
      topic,
      messages: [
        {
          value: JSON.stringify(bundle),
        },
      ],
    });
  } catch (error) {
    if (typeof error === 'string') {
      return new Error(error);
    } else if (error instanceof Error) {
      return error;
    }
  }

  return null;
};

export const sendToFhirAndKafka = async (
  requestDetails: RequestDetails,
  bundle: Bundle,
  newPatientRef: NewPatientMap = {}
): Promise<MpiMediatorResponseObject> => {
  const { protocol, host, port, path, headers } = requestDetails;

  const response: ResponseObject = await postData(
    protocol,
    host,
    port,
    path,
    JSON.stringify(bundle),
    headers
  );

  let transactionStatus: string;

  if (isHttpStatusOk(response.status)) {
    logger.info('Successfully sent Fhir bundle to the Fhir Datastore!');

    transactionStatus = 'Success';

    // Restore full patient resources to the bundle for sending to Kafka
    Object.keys(newPatientRef).forEach((fullUrl) => {
      const patientData = newPatientRef[fullUrl];

      if (patientData.restoredPatient && bundle.entry) {
        const patientEntry: BundleEntry = {
          fullUrl: fullUrl,
          resource: patientData.restoredPatient,
          request: {
            method: 'PUT',
            url: `Patient/${patientData.mpiResponsePatient?.id}`,
          },
        };

        // Replace entry with matching fullUrl, else push new entry
        const index = bundle.entry.findIndex((entry) => entry.fullUrl === fullUrl);

        if (index !== -1) {
          logger.debug(
            `Replacing patient (fullUrl: ${fullUrl}) resource in bundle with restored copy`
          );
          bundle.entry[index] = patientEntry;
        } else {
          logger.debug(
            `Adding restored patient (fullUrl: ${fullUrl}) resource to bundle, no matching entry found`
          );
          bundle.entry.push(patientEntry);
        }
      }
    });

    const kafkaResponseError: Error | null = await sendToKafka(
      bundle,
      config.kafkaBundleTopic
    );

    if (kafkaResponseError) {
      logger.error(
        `Sending Fhir bundle to Kafka failed: ${JSON.stringify(kafkaResponseError)}`
      );

      transactionStatus = 'Failed';
      response.body = { kafkaResponseError };
      response.status = 500;
    } else {
      logger.info('Successfully sent Fhir bundle to Kafka');
    }
  } else {
    logger.error(
      `Error in sending Fhir bundle to Fhir Datastore: ${JSON.stringify(response.body)}!`
    );
    transactionStatus = 'Failed';
  }

  return createHandlerResponseObject(transactionStatus, response);
};

const clientRegistryRequestDetailsOrg: RequestDetails = {
  protocol: config.mpiProtocol,
  host: config.mpiHost,
  port: config.mpiPort,
  path: '/fhir/Patient',
  method: 'POST',
  headers: { 'Content-Type': 'application/fhir+json' },
};
const fhirDatastoreRequestDetailsOrg: RequestDetails = {
  protocol: config.fhirDatastoreProtocol,
  host: config.fhirDatastoreHost,
  port: config.fhirDatastorePort,
  headers: { 'Content-Type': 'application/fhir+json' },
  method: 'POST',
  path: '/fhir'
};

export const processBundle = async (bundle: Bundle): Promise<MpiMediatorResponseObject> => {
  const fhirDatastoreRequestDetails: RequestDetails = { ...fhirDatastoreRequestDetailsOrg };
  const clientRegistryRequestDetails: RequestDetails = { ...clientRegistryRequestDetailsOrg };

  const patientEntries = extractPatientEntries(bundle);

  if (patientEntries.length === 0) {
    logger.info(
      'No Patient resource was found in Fhir Bundle, sending directly to Fhir Datastore and Kafka'
    );

    const handlerResponse: MpiMediatorResponseObject = await sendToFhirAndKafka(
      fhirDatastoreRequestDetails,
      modifyBundle(bundle)
    );

    return handlerResponse;
  }

  if (config.mpiAuthEnabled) {
    const auth: OAuth2Token = await getMpiAuthToken();

    clientRegistryRequestDetails.headers = {
      ...clientRegistryRequestDetails.headers,
      ['Authorization']: `Bearer ${auth.accessToken}`,
    };
  }

  const newPatientMap: NewPatientMap = {};
  // transform and send each patient resource and submit to MPI
  const promises = patientEntries.map(async (patientEntry) => {
    if (patientEntry.fullUrl) {
      // Check if patient already exists and perform update
      const guttedPatient = await sendRequest({
        ...fhirDatastoreRequestDetails,
        method: 'GET',
        path: `/fhir/Patient/${patientEntry.fullUrl.split('/').pop()}`,
      });
      if (isHttpStatusOk(guttedPatient.status)) {
        const mpiPatient = await sendRequest({
          ...clientRegistryRequestDetails,
          method: 'GET',
          path: `/fhir/links/Patient/${Object.assign(guttedPatient.body).link[0].other.reference}`,
        });
        clientRegistryRequestDetails.method = 'PUT';
        clientRegistryRequestDetails.path = `/fhir/Patient/${
          Object.assign(mpiPatient.body).id
        }`;
      }
      newPatientMap[patientEntry.fullUrl] = {
        mpiTransformResult: transformPatientResourceForMPI(patientEntry.resource as Patient),
      };
      clientRegistryRequestDetails.data = JSON.stringify(
        newPatientMap[patientEntry.fullUrl].mpiTransformResult?.patient
      );
    } else {
      const error = 'Patient entry in bundle is missing the "fullUrl"!';

      logger.error(error);

      return Promise.resolve(
        createHandlerResponseObject('Failed', { status: 400, body: { error } })
      );
    }

    return sendRequest(clientRegistryRequestDetails);
  });

  const clientRegistryResponses = await Promise.all(promises);

  const failedRequests = clientRegistryResponses.filter(
    (clientRegistryResponse) => !isHttpStatusOk(clientRegistryResponse.status)
  );

  if (failedRequests.length > 0) {
    logger.error(
      `Patient resource creation in Client Registry failed: ${JSON.stringify(failedRequests)}`
    );

    // combine all failed requests into a single response
    const combinedResponse: ResponseObject = failedRequests.reduce(
      (combined: { status: number; body: { errors: any[] } }, current) => {
        combined.body.errors.push(current.body);

        return combined;
      },
      { status: failedRequests[0].status, body: { errors: [] } }
    );

    return createHandlerResponseObject('Failed', combinedResponse);
  }

  clientRegistryResponses.map((clientRegistryResponse, index) => {
    const fullUrl = patientEntries[index]?.fullUrl;

    if (fullUrl) {
      newPatientMap[fullUrl].mpiResponsePatient = JSON.parse(
        JSON.stringify(clientRegistryResponse.body)
      );
    }
  });

  // create a new bundle with stripped out patient and references to the MPI patient
  const modifiedBundle: Bundle = modifyBundle(
    bundle,
    newPatientMap,
    config.patientProfileForStubPatient
  );

  Object.values(newPatientMap).forEach((patientData) => {
    restorePatientResource(patientData);
  });

  const handlerResponse: MpiMediatorResponseObject = await sendToFhirAndKafka(
    fhirDatastoreRequestDetails,
    modifiedBundle,
    newPatientMap
  );

  return handlerResponse;
};
