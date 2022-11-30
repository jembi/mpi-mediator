export const getConfig = () => {
  return Object.freeze({
    port: process.env.SERVER_PORT || 3000,
    logLevel: process.env.LOG_LEVEL || 'info',
    fhirDatastoreHost: process.env.FHIR_DATASTORE_HOST || 'localhost',
    fhirDatastorePort: process.env.FHIR_DATASTORE_PORT || 3447,
    fhirDatastoreProtocol: process.env.FHIR_DATASTORE_PROTOCOL || 'http', 
    mediatorUrn: process.env.MEDIATOR_URN || 'urn:mediator:mpi-mediator',
    clientRegistryHost: process.env.CLIENT_REGISTRY_HOST || 'localhost',
    clientRegistryProtocol: process.env.CLIENT_REGISTRY_PROTOCOL || 'http',
    clientRegistryPort: process.env.CLIENT_REGISTRY_PORT || 8084,
    clientRegistryAuthPath: process.env.CIENT_REGISTRY_AUTH_PATH || '/auth/oauth2_token',
    clientRegistryAuthCredentials: process.env.CLIENT_REGISTRY_AUTH_CREDENTIALS || `grant_type=client_credentials&scope=*&client_id=DISI\ CLIENT&client_secret=DISI&resource=oath2_token`,
    clientRegistryAuthCredentialsContentType: process.env.CLIENT_REGISTRY_AUTH_CREDENTIALS_CONTENT_TYPE || 'application/x-www-form-urlencoded',
    clientRegistryAuthHeaderType: process.env.CLIENT_REGISTRY_AUTH_TYPE || 'Bearer',
    kafkaBrokers: process.env.kAFKA_BROKERS || 'kafka:9092',
    kafkaBundleTopic: process.env.KAFKA_BUNDLE_TOPIC || '2xx',
    kafkaAsyncBundleTopic: process.env.KAFKA_ASYNC_BUNDLE_TOPIC || '2xx-async',
    kafkaErrorTopic: process.env.KAFKA_ERROR_TOPIC || 'errors',
    mpiKafkaClientId: process.env.MPI_KAFKA_CLIENT_ID || 'mpi-mediator',
    runningMode: process.env.MODE || ''
  });
};
