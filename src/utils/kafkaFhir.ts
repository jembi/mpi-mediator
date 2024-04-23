import { Kafka, logLevel } from 'kafkajs';
import format from 'date-fns/format';
import { Bundle, BundleEntry, Patient } from 'fhir/r3';

import { getConfig } from '../config/config';
import { RequestDetails } from '../types/request';
import { MpiMediatorResponseObject, Orchestration, ResponseObject } from '../types/response';
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
  newPatientRef: NewPatientMap = {},
  orchestrations: Orchestration[] = []
): Promise<MpiMediatorResponseObject> => {
  const { protocol, host, port, path, headers } = requestDetails;

  const requestStartTime = format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSXXX");

  const response: ResponseObject = await postData(
    protocol,
    host,
    port,
    path,
    JSON.stringify(bundle),
    headers
  );

  const orchestration: Orchestration = {
    name: 'Saving data in Fhir Datastore - hapi-fhir',
    request: {
      protocol,
      host,
      port,
      method: 'POST',
      path,
      body: JSON.stringify(bundle),
      headers,
      timestamp: requestStartTime
    },
    response: {
      status: response.status,
      body: JSON.stringify(response.body),
      timestamp: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSXXX"),
      headers: {'Content-Type': 'application/fhir+json'}
    }
  }
  orchestrations.push(orchestration);

  let transactionStatus: string;

  if (isHttpStatusOk(response.status)) {
    logger.info('Successfully sent Fhir bundle to the Fhir Datastore!');

    transactionStatus = 'Success';

    // Restore full patient resources to the bundle for sending to Kafka
    Object.keys(newPatientRef).forEach((fullUrl) => {
      const patientData = newPatientRef[fullUrl];
      const url = `Patient/${patientData.mpiResponsePatient?.id}`;

      if (patientData.restoredPatient && bundle.entry) {
        const patientEntry: BundleEntry = {
          fullUrl,
          resource: patientData.restoredPatient,
          request: {
            method: 'PUT',
            url
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

        // Replace the old patient reference in the resources
        const oldId = fullUrl.split('/').pop();

        if (oldId) {
          bundle = JSON.parse(JSON.stringify(bundle).replace(RegExp(`Patient/${oldId}`, 'g'), url));
        }
      }
    });

    const orchestration: Orchestration = {
      name: 'Sending to message bus - kafka',
      request: {
        host: config.kafkaBrokers,
        timestamp: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSXXX")
      },
      response: {
        status: 200,
        body: JSON.stringify({success: true}),
        timestamp: '',
        headers: { 'Content-Type': 'application/fhir+json' }
      }
    };

    const kafkaResponseError: Error | null = await sendToKafka(
      bundle,
      config.kafkaBundleTopic
    );

    orchestration.response.timestamp = format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSXXX");

    if (kafkaResponseError) {
      logger.error(
        `Sending Fhir bundle to Kafka failed: ${JSON.stringify(kafkaResponseError)}`
      );

      transactionStatus = 'Failed';
      response.body = { kafkaResponseError };
      response.status = 500;

      orchestration.response.status = 500;
      orchestration.response.body = JSON.stringify(kafkaResponseError);
    } else {
      logger.info('Successfully sent Fhir bundle to Kafka');
    }

    orchestrations.push(orchestration);
  } else {
    logger.error(
      `Error in sending Fhir bundle to Fhir Datastore: ${JSON.stringify(response.body)}!`
    );
    transactionStatus = 'Failed';
  }

  return createHandlerResponseObject(transactionStatus, response, orchestrations);
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
  path: '/fhir',
  data: '',
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
  const orchestrations: Orchestration[] = [];

  // transform and send each patient resource and submit to MPI
  const promises = patientEntries.map(async (patientEntry) => {
    if (patientEntry.fullUrl) {
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
    orchestrations.push({
      name: `Request to Client Registry - ${patientEntry.fullUrl}`,
      request: {...clientRegistryRequestDetails, timestamp: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSXXX")},
      response: {
        status: 201,
        body: '',
        timestamp: ''
      }
    })
    return sendRequest(clientRegistryRequestDetails);
  });

  const clientRegistryResponses = await Promise.all(promises);

  clientRegistryResponses.forEach((resp, index) => {
    orchestrations[index].response = {
      status: resp.status,
      body: JSON.stringify(resp.body),
      timestamp: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSXXX"),
      headers: { 'Content-Type': 'application/fhir+json' }
    }
  });

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

    return createHandlerResponseObject('Failed', combinedResponse, orchestrations);
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
    newPatientMap,
    orchestrations
  );

  return handlerResponse;
};
