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
    resources: process.env.PATIENT_EVERYTHING_RESOURCES?.split(',') || [
      'Encounter',
      'Observation',
    ],
    openhimUsername: process.env.OPENHIM_USERNAME || 'root@openhim.org',
    openhimPassword: process.env.OPENHIM_PASSWORD || 'instant101',
    trustSelfSigned: process.env.TRUST_SELF_SIGNED === 'false' ? false : true,
    fhirDatastoreHost: process.env.FHIR_DATASTORE_HOST || 'hapi-fhir',
    fhirDatastorePort: process.env.FHIR_DATASTORE_PORT || 8080,
    fhirDatastoreProtocol: process.env.FHIR_DATASTORE_PROTOCOL || 'http',
    contentType: process.env.MEDIATOR_INPUT_CONTENT_TYPE || 'application/fhir+json',
    mediatorUrn: process.env.MEDIATOR_URN || 'urn:mediator:mpi-mediator',
    kafkaBrokers: process.env.KAFKA_BROKERS || 'kafka:9092',
    kafkaBundleTopic: process.env.KAFKA_BUNDLE_TOPIC || '2xx',
    kafkaAsyncBundleTopic: process.env.KAFKA_ASYNC_BUNDLE_TOPIC || '2xx-async',
    kafkaErrorTopic: process.env.KAFKA_ERROR_TOPIC || 'errors',
    kafkaPatientTopic: process.env.KAFKA_PATIENT_TOPIC ?? 'patient',
    mpiKafkaClientId: process.env.MPI_KAFKA_CLIENT_ID || 'mpi-mediator',
    runningMode: process.env.MODE || '',
    mpiHost: process.env.MPI_HOST || 'santedb-mpi',
    mpiPort: process.env.MPI_PORT || 8080,
    mpiProtocol: process.env.MPI_PROTOCOL || 'http',
    mpiAuthEnabled: process.env.MPI_AUTH_ENABLED === 'false' ? false : true,
    mpiClientId: process.env.MPI_CLIENT_ID || '',
    mpiClientSecret: process.env.MPI_CLIENT_SECRET || '',
    mpiProxyUrl: process.env.MPI_PROXY_URL || '',
    cucumberDefaultTimeout: process.env.CUCUMBER_DEFAULT_TIMEOUT || 20000,
    disableValidation: process.env.DISABLE_VALIDATION == 'true' ? true : false,
    enableJempiGoldenIdUpdate:
      process.env.ENABLE_JEMPI_GOLDEN_ID_UPDATE == 'true' ? true : false,
    kafkaJempiAuditTopic: process.env.KAFKA_JEMPI_AUDIT_TOPIC ?? 'JeMPI-audit-trail',
    bodySizeLimit: process.env.BODY_SIZE_LIMIT || '50mb',
    patientProfileForStubPatient: process.env.PATIENT_PROFILE_FOR_STUB_PATIENT || '',
  });
};
