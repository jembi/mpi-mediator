import { Bundle } from 'fhir/r3';
import { getConfig } from '../../config/config';
import logger from '../../logger';
import { MpiMediatorResponseObject } from '../../types/response';
import { resources } from '../../utils/resources';
import { buildOpenhimResponseObject, getData, unbundle } from '../../utils/utils';

const {
  fhirDatastoreProtocol: protocol,
  fhirDatastoreHost: host,
  fhirDatastorePort: port,
} = getConfig();

export const fetchResourcesRelatedToPatient = async (ref: string): Promise<Bundle> => {
  const patientRef = `http://santedb-mpi:8080/fhir/Patient/${ref}`;

  const bundles = resources.map(async (resource) => {
    const path = `/fhir/${resource}?subject=${patientRef}`;
    const response = await getData(protocol, host, port, path);

    return response.body as Bundle;
  });

  return unbundle(await Promise.all(bundles));
};

// export const fetchPatientResources = async (): Promise<MpiMediatorResponseObject> => {
//   logger.info('Fetching resources for Patient');

//   const response = await fetchResourcesRelatedToPatient(reqDetails);

//   let transactionStatus: string;

//   if (response.entry) {
//     logger.info('Successfully validated bundle!');
//     transactionStatus = 'Success';
//   } else {
//     logger.error(`Error in validating: ${JSON.stringify(response.body)}!`);
//     transactionStatus = 'Failed';
//   }

//   const responseBody = buildOpenhimResponseObject(
//     transactionStatus,
//     response.status,
//     response
//   );

//   return {
//     body: responseBody,
//     status: response.status,
//   };
// };
