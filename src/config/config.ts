export const getConfig = () => {
  return Object.freeze({
    port: process.env.SERVER_PORT || 3000,
    logLevel: process.env.LOG_LEVEL || 'info',
    fhirDatastoreHost: process.env.FHIR_DATASTORE_HOST || 'hapi-fhir',
    fhirDatastorePort: process.env.FHIR_DATASTORE_PORT || 8080,
    fhirDatastoreProtocol: process.env.FHIR_DATASTORE_PROTOCOL || 'http', 
    mediatorUrn: process.env.MEDIATOR_URN || 'urn:mediator:mpi-mediator',
    clientRegistryHost: process.env.CLIENT_REGISTRY_HOST || 'santempi',
    clientRegistryProtocol: process.env.CLIENT_REGISTRY_PROTOCOL || 'http',
    clientRegistryPort: process.env.CLIENT_REGISTRY_PORT || 8080,
    clientRegistryAuthPath: process.env.CIENT_REGISTRY_AUTH_PATH || '/auth/oauth2_token',
    clientRegistryAuthCredentials: process.env.CLIENT_REGISTRY_AUTH_CREDENTIALS || `grant_type=client_credentials&scope=*&client_id='DISI CLIENT'&client_secret=DISI&resource=oath2_token`,
    clientRegistryAuthCredentialsContentType: process.env.CLIENT_REGISTRY_AUTH_CREDENTIALS_CONTENT_TYPE || 'application/x-www-form-urlencoded',
    clientRegistryAuthHeaderType: process.env.CLIENT_REGISTRY_AUTH_TYPE || 'Bearer',
    runningMode: process.env.MODE || ''
  });
};
