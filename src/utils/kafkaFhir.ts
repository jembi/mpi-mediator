import { Kafka, logLevel } from 'kafkajs';

import { Bundle, BundleEntry, Patient, Resource } from 'fhir/r3';
import { getConfig } from '../config/config';
import { RequestDetails } from '../types/request';
import {
  MpiMediatorResponseObject,
  ResponseObject,
  MpiTransformResult,
} from '../types/response';
import {
  createHandlerResponseObject,
  createNewPatientRef,
  extractPatientId,
  extractPatientResource,
  isHttpStatusOk,
  modifyBundle,
  postData,
  sendRequest,
  transformPatientResourceForMPI,
} from './utils';
import logger from '../logger';
import { getMpiAuthToken } from './mpi';
import { OAuth2Token } from './client-oauth2';

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
  patient: Patient | null = null,
  newPatientRef = ''
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

    if (patient) {
      const patientEntry: BundleEntry = {
        fullUrl: newPatientRef,
        resource: Object.assign(
          {
            id: '',
            resourceType: '',
          },
          patient
        ),
        request: {
          method: 'PUT',
          url: newPatientRef,
        },
      };

      bundle.entry?.push(patientEntry);

      const entry: BundleEntry[] = [];
      const newBundle = Object.assign({ entry: entry }, response.body);

      newBundle.entry.push(patientEntry);
      response.body = newBundle;
    }

    if (newPatientRef && patient) {
      bundle = JSON.parse(
        JSON.stringify(bundle).replace(
          new RegExp(newPatientRef, 'g'),
          `Patient/${patient?.id}`
        )
      );
    }

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
  path: '/fhir',
  data: '',
};

export const processBundle = async (bundle: Bundle): Promise<MpiMediatorResponseObject> => {
  const fhirDatastoreRequestDetails: RequestDetails = { ...fhirDatastoreRequestDetailsOrg };
  const clientRegistryRequestDetails: RequestDetails = { ...clientRegistryRequestDetailsOrg };

  const patientResource: Resource | null = extractPatientResource(bundle);
  const patientId: string | null = extractPatientId(bundle);
  let patientMpiTransformResult: MpiTransformResult = {};

  if (!(patientResource || patientId)) {
    logger.info('No Patient resource or Patient reference was found in Fhir Bundle!');

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

  if (!patientResource && patientId) {
    clientRegistryRequestDetails.path = `/fhir/Patient/${patientId}`;
    clientRegistryRequestDetails.method = 'GET';
    delete clientRegistryRequestDetails.data;
  } else {
    patientMpiTransformResult = transformPatientResourceForMPI(patientResource as Resource);
    clientRegistryRequestDetails.data = JSON.stringify(patientMpiTransformResult.patient);
  }

  const clientRegistryResponse: ResponseObject = await sendRequest(
    clientRegistryRequestDetails
  );

  if (!isHttpStatusOk(clientRegistryResponse.status)) {
    if (patientResource) {
      logger.error(
        `Patient resource creation in Client Registry failed: ${JSON.stringify(
          clientRegistryResponse.body
        )}`
      );
    } else {
      logger.error(
        `Checking of patient with id ${patientId} failed in Client Registry: ${JSON.stringify(
          clientRegistryResponse.body
        )}`
      );
    }

    return createHandlerResponseObject('Failed', clientRegistryResponse);
  }

  const newPatientRef: string = createNewPatientRef(
    JSON.parse(JSON.stringify(clientRegistryResponse.body))['id']
  );
  const modifiedBundle: Bundle = modifyBundle(bundle, `Patient/${patientId}`, newPatientRef);

  //Add the patient's managing organization and extensions
  let transformedPatient = Object.assign({}, clientRegistryResponse.body);

  if (patientResource) {
    if (patientMpiTransformResult.extension?.length) {
      transformedPatient = Object.assign({}, transformedPatient, {
        extension: patientMpiTransformResult.extension,
      });
    }

    if (patientMpiTransformResult.managingOrganization) {
      transformedPatient = Object.assign({}, transformedPatient, {
        managingOrganization: patientMpiTransformResult.managingOrganization,
      });
    }
  }

  const handlerResponse: MpiMediatorResponseObject = await sendToFhirAndKafka(
    fhirDatastoreRequestDetails,
    modifiedBundle,
    transformedPatient as Patient,
    newPatientRef
  );

  return handlerResponse;
};
