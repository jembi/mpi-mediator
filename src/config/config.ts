enum LogLevel {
  debug = 'debug',
  info = 'info',
  warn = 'warn',
  error = 'error',
  silent = 'silent',
}

export const getConfig = () => {
  return Object.freeze({
    port: process.env.SERVER_PORT || 3000,
    logLevel: (process.env.LOG_LEVEL || 'debug') as LogLevel,
    fhirDatastoreHost: process.env.FHIR_DATASTORE_HOST || 'hapi-fhir',
    fhirDatastorePort: process.env.FHIR_DATASTORE_PORT || 8080,
    fhirDatastoreProtocol: process.env.FHIR_DATASTORE_PROTOCOL || 'http',
    mediatorUrn: process.env.MEDIATOR_URN || 'urn:mediator:mpi-mediator',
    runningMode: process.env.MODE || '',
    santeMpiHost: process.env.SANTE_MPI_HOST || 'santedb-mpi',
    santeMpiPort: process.env.SANTE_MPI_PORT || 8080,
    santeMpiProtocol: process.env.SANTE_MPI_PROTOCOL || 'http',
    santeMpiClientId: process.env.SANTE_MPI_CLIENT_ID || '',
    santeMpiClientSecret: process.env.SANTE_MPI_CLIENT_SECRET || '',
  });
};
