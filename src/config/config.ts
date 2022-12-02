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
    registerMediator: process.env.REGISTER_MEDIATOR === "true" || false,
    openhimMediatorUrl: process.env.OPENHIM_MEDIATOR_URL || 'https://localhost:8080',
    openhimUsername: process.env.OPENHIM_USERNAME || 'root@openhim.org',
    openhimPassword: process.env.OPENHIM_PASSWORD || 'instant101',
    trustSelfSigned: process.env.TRUST_SELF_SIGNED === "true" || false,
    fhirDatastoreHost: process.env.FHIR_DATASTORE_HOST || 'hapi-fhir',
    fhirDatastorePort: process.env.FHIR_DATASTORE_PORT || 8080,
    fhirDatastoreProtocol: process.env.FHIR_DATASTORE_PROTOCOL || 'http',
    mediatorUrn: process.env.MEDIATOR_URN || 'urn:mediator:mpi-mediator',
    runningMode: process.env.MODE || '',
    mpiHost: process.env.MPI_HOST || 'santedb-mpi',
    mpiPort: process.env.MPI_PORT || 8080,
    mpiProtocol: process.env.MPI_PROTOCOL || 'http',
    mpiAuthEnabled: process.env.MPI_AUTH_ENABLED === 'true' || true,
    mpiClientId: process.env.MPI_CLIENT_ID || '',
    mpiClientSecret: process.env.MPI_CLIENT_SECRET || '',
  });
};
