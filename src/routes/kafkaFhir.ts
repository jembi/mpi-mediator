import { Kafka, logLevel } from "kafkajs";

import { Bundle, Entry } from "../types/bundle";
import { getConfig } from "../config/config";
import { RequestDetails } from "../types/request";
import { HandlerResponseObect, ResponseObject } from "../types/response";
import { createHandlerResponseObject, sendRequest } from "./utils";
import logger from "../logger";

const config = getConfig();

const kafka = new Kafka({
  logLevel: logLevel.ERROR,
  clientId: config.mpiKafkaClientId,
  brokers: config.kafkaBrokers.split(","),
});
const producer = kafka.producer();

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
