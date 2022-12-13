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
    registerMediator: process.env.REGISTER_MEDIATOR === 'false' ? false : true,
    openhimMediatorUrl: process.env.OPENHIM_MEDIATOR_URL || 'https://localhost:8080',
    openhimUsername: process.env.OPENHIM_USERNAME || 'root@openhim.org',
    openhimPassword: process.env.OPENHIM_PASSWORD || 'instant101',
    trustSelfSigned: process.env.TRUST_SELF_SIGNED === 'false' ? false : true,
    fhirDatastoreHost: process.env.FHIR_DATASTORE_HOST || 'hapi-fhir',
    fhirDatastorePort: process.env.FHIR_DATASTORE_PORT || 8080,
    fhirDatastoreProtocol: process.env.FHIR_DATASTORE_PROTOCOL || 'http',
    mediatorUrn: process.env.MEDIATOR_URN || 'urn:mediator:mpi-mediator',
    kafkaBrokers: process.env.KAFKA_BROKERS || 'kafka:9092',
    kafkaBundleTopic: process.env.KAFKA_BUNDLE_TOPIC || '2xx',
    kafkaAsyncBundleTopic: process.env.KAFKA_ASYNC_BUNDLE_TOPIC || '2xx-async',
    kafkaErrorTopic: process.env.KAFKA_ERROR_TOPIC || 'errors',
    mpiKafkaClientId: process.env.MPI_KAFKA_CLIENT_ID || 'mpi-mediator',
    runningMode: process.env.MODE || '',
    mpiHost: process.env.MPI_HOST || 'santedb-mpi',
    mpiPort: process.env.MPI_PORT || 8080,
    mpiProtocol: process.env.MPI_PROTOCOL || 'http',
    mpiAuthEnabled: process.env.MPI_AUTH_ENABLED === 'false' ? false : true,
    mpiClientId: process.env.MPI_CLIENT_ID || '',
    mpiClientSecret: process.env.MPI_CLIENT_SECRET || '',
  });
};
