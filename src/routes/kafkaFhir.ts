import { Kafka, logLevel } from "kafkajs";

import { Bundle, Entry, Resource } from "../types/bundle";
import { getConfig } from "../config/config";
import { RequestDetails } from "../types/request";
import {
  AuthHeader,
  HandlerResponseObect,
  ResponseObject,
} from "../types/response";
import {
  createAuthHeaderToken,
  createHandlerResponseObject,
  createNewPatientRef,
  extractPatientId,
  extractPatientResource,
  modifyBundle,
  sendRequest,
} from "./utils";
import logger from "../logger";

const config = getConfig();

const kafka = new Kafka({
  logLevel: logLevel.ERROR,
  clientId: config.mpiKafkaClientId,
  brokers: config.kafkaBrokers.split(","),
});
const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: "mpi-mediator" });

const clientRegistryRequestDetails: RequestDetails = {
  protocol: config.clientRegistryProtocol,
  host: config.clientRegistryHost,
  port: config.clientRegistryPort,
  path: "/fhir/Patient",
  method: "POST",
  contentType: "application/fhir+json",
  authToken: "",
};
const fhirDatastoreRequestDetails: RequestDetails = {
  protocol: config.fhirDatastoreProtocol,
  host: config.fhirDatastoreHost,
  port: config.fhirDatastorePort,
  contentType: "application/fhir+json",
  method: "POST",
  path: "/fhir",
  data: "",
};

export const asyncPatientMatchHandler = async (): Promise<void> => {
  await consumer.connect();
  await consumer.subscribe({
    topic: config.kafkaAsyncBundleTopic,
    fromBeginning: true,
  });

  logger.info('Kafka consumer started');

  await consumer.run({
    eachMessage: async ({ message }) => {
      logger.info('Fhir bundle received from queue')

      consumer.pause([{ topic: config.kafkaAsyncBundleTopic }]);
      const bundleString: string | undefined = message.value?.toString();
      let bundle: Bundle;

      if (!bundleString) {
        logger.error("Invalid Fhir bundle received from Kafka");
        consumer.resume([{ topic: config.kafkaAsyncBundleTopic }]);
        return;
      } else {
        bundle = JSON.parse(bundleString);
      }

      await processBundle(bundle);
      consumer.resume([{ topic: config.kafkaAsyncBundleTopic }]);
    },
  });
};

export const processBundle = async (bundle: Bundle): Promise<void> => {
  const patientResource: Resource | null = extractPatientResource(bundle);
  const patientId: string | null = extractPatientId(bundle);

  if (!(patientResource || patientId)) {
    logger.info("No Patient resource or Patient reference was found in Fhir Bundle!");

    const response: HandlerResponseObect = await sendToFhirAndKafka(fhirDatastoreRequestDetails, modifyBundle(bundle));
    
    checkPostResponse(response);
    return;
  }

  const auth: AuthHeader = await createAuthHeaderToken();
  clientRegistryRequestDetails.authToken = auth.token;

  if (!patientResource && patientId) {
    clientRegistryRequestDetails.path = `/fhir/Patient/${patientId}`;
    clientRegistryRequestDetails.method = "GET";
    delete clientRegistryRequestDetails.data;
  } else {
    clientRegistryRequestDetails.data = JSON.stringify(patientResource);
  }

  const clientRegistryResponse: ResponseObject = await sendRequest(clientRegistryRequestDetails);
  
  const responseError = checkClientRegistryResponse(clientRegistryResponse, patientResource, patientId)
  if (responseError) return;

  const newPatientRef: string = createNewPatientRef(clientRegistryResponse.body);
  const modifiedBundle: Bundle = modifyBundle(bundle, `Patient/${patientId}`, newPatientRef);
    
  const response: HandlerResponseObect = await sendToFhirAndKafka(
    fhirDatastoreRequestDetails,
    modifiedBundle,
    clientRegistryResponse.body,
    newPatientRef
  );

  checkPostResponse(response);
};

const checkClientRegistryResponse = (
  clientRegistryResponse: ResponseObject,
  patientResource: Resource | null,
  patientId: string | null
): string | null => {
  if (
    !(
      clientRegistryResponse.status === 201 ||
      clientRegistryResponse.status === 200
    )
  ) {
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
    return "Failed";
  }
  logger.info(`Patient ${patientResource ? 'creation' : 'verification' } successful in Client Registry`)
  return null;
};

const checkPostResponse = (
  response: ResponseObject
) => {
  if (response.status !== 200) {
    logger.error(
      `Failed to process Fhir bundle - ${JSON.stringify(response.body)}`
    );
  } else {
    logger.info('Successfully sent Fhir Bundle to Fhir datastore and Kafka');
  }
};

export const sendToKafka = async (
  bundle: Bundle,
  topic: string
): Promise<Error | null> => {
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
    if (typeof error === "string") {
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
  patient: object | null = null,
  newPatientRef: string = ""
): Promise<HandlerResponseObect> => {
  requestDetails.data = JSON.stringify(bundle);

  const response: ResponseObject = await sendRequest(requestDetails);

  let transactionStatus: string;

  if (response.status === 200) {
    logger.info("Successfully sent Fhir bundle to the Fhir Datastore!");

    transactionStatus = "Success";

    if (patient) {
      const patientEntry: Entry = {
        fullUrl: newPatientRef,
        resource: Object.assign(
          {
            id: "",
            resourceType: "",
          },
          patient
        ),
        request: {
          method: "PUT",
          url: newPatientRef,
        },
      };
      bundle.entry.push(patientEntry);
      const entry: Entry[] = [];
      const newBundle = Object.assign({ entry: entry }, response.body);
      newBundle.entry.push(patientEntry);
      response.body = newBundle;
    }

    const kafkaResponseError: Error | null = await sendToKafka(
      bundle,
      config.kafkaBundleTopic
    );

    if (kafkaResponseError) {
      logger.error(
        `Sending Fhir bundle to Kafka failed: ${JSON.stringify(
          kafkaResponseError
        )}`
      );

      transactionStatus = "Failed";
      response.body = { kafkaResponseError };
      response.status = 500;
    } else {
      logger.error("Successfully sent Fhir bundle to Kafka");
    }
  } else {
    logger.error(
      `Error in sending Fhir bundle to Fhir Datastore: ${JSON.stringify(
        response.body
      )}!`
    );
    transactionStatus = "Failed";
  }

  return createHandlerResponseObject(transactionStatus, response);
};
