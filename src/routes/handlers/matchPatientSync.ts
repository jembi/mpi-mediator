import {
  createAuthHeaderToken,
  createHandlerResponseObject,
  createNewPatientRef,
  extractPatientId,
  extractPatientResource,
  modifyBundle,
  sendRequest
} from '../utils';
import { getConfig } from "../../config/config";
import logger from "../../logger";
import { Bundle, Resource } from "../../types/bundle";
import { ResponseObject, HandlerResponseObect, AuthHeader } from '../../types/response';
import { RequestDetails } from '../../types/request';
import { sendToFhirAndKafka } from '../kafkaFhir';

const config = getConfig();

const ClientRegistryRequestDetailsOrg: RequestDetails = {
  protocol: config.clientRegistryProtocol,
  host: config.clientRegistryHost,
  port: config.clientRegistryPort,
  path: '/fhir/Patient',
  method: 'POST',
  contentType: 'application/fhir+json',
  authToken: ''
};
const fhirDatastoreRequestDetailsOrg: RequestDetails = {
  protocol: config.fhirDatastoreProtocol,
  host: config.fhirDatastoreHost,
  port: config.fhirDatastorePort,
  contentType: 'application/fhir+json',
  method: 'POST',
  path: '/fhir',
  data: ''
};

export const matchSyncHandler = async (bundle: Bundle) : Promise<HandlerResponseObect> => {
  logger.info('Fhir bundle recieved for synchronous matching of the patient!');

  const fhirDatastoreRequestDetails: RequestDetails = Object.assign({}, fhirDatastoreRequestDetailsOrg);
  const clientRegistryRequestDetails: RequestDetails = Object.assign({}, ClientRegistryRequestDetailsOrg);
  const patientResource: Resource | null = extractPatientResource(bundle);
  const patientId: string | null = extractPatientId(bundle);

  if (!(patientResource || patientId)) {
    logger.info('No Patient resource or Patient reference was found in Fhir Bundle!');

    const handlerResponse: HandlerResponseObect = await sendToFhirAndKafka(fhirDatastoreRequestDetails, modifyBundle(bundle));
    return handlerResponse;
  }

  const auth: AuthHeader = await createAuthHeaderToken();
  clientRegistryRequestDetails.authToken = auth.token;

  if (!patientResource && patientId) {
    clientRegistryRequestDetails.path = `/fhir/Patient/${patientId}`;
    clientRegistryRequestDetails.method = 'GET';
  } else {
    clientRegistryRequestDetails.data = JSON.stringify(patientResource)
  }

  const clientRegistyResponse: ResponseObject = await sendRequest(clientRegistryRequestDetails);

  if (!(clientRegistyResponse.status === 201 || clientRegistyResponse.status === 200)) {
    if (patientResource) {
      logger.error(`Patient resource creation in Client Registry failed: ${JSON.stringify(clientRegistyResponse.body)}`);
    } else {
      logger.error(`Checking of patient with id ${patientId} failed in Client Registry: ${JSON.stringify(clientRegistyResponse.body)}`);
    }
    return createHandlerResponseObject('Failed', clientRegistyResponse);
  }

  const newPatientRef: string = createNewPatientRef(clientRegistyResponse.body);
  const modifiedBundle: Bundle = modifyBundle(bundle, `Patient/${patientId}`, newPatientRef);

  const handlerResponse: HandlerResponseObect = await sendToFhirAndKafka(
    fhirDatastoreRequestDetails, modifiedBundle, clientRegistyResponse.body, newPatientRef
  );

  return handlerResponse;
};
