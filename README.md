# mpi-mediator

An OpenHIM mediator to handle all interactions with an MPI component and Hapi Fhir

## Testing

There are two types of tests, unit and integration. The integration tests are done using the [Cucumber](https://cucumber.io/) framework. For the integration tests, the FHIR Datastore service has to be running, and the fhir datastore host and port have to be specified in the `/src/config/config` file, or via environment variables **FHIR_DATASTORE_HOST** and **FHIR_DATASTORE_PORT**.

Run the commands below to test

```sh
npm run test:unit      // Unit tests

npm run test:cucumber  // Integration tests
```

## API Endpoints

### SYNC - Query for registered patients

Requests sent to this endpoint will be forwarded as an OAuth2 authenticated POST request to the MPI endpoint (eg. http://santedb-mpi/fhir/Patient).

| Endpoint      | POST /fhir/Patient/$match                                                                                                                                                                                                                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Body          | FHIR Parameters object - [see here](https://www.hl7.org/fhir/patient-operation-match.html)                                                                                                                                                                                                                                                  |
| Response      | FHIR bundle with matched master patients                                                                                                                                                                                                                                                                                                    |
| Details       | This query is authenticated by the OpenHIM and passed directly to the active MPI system. If the MPI API requires OAuth access token authentication then an auth mediator is therefore needed that creates the access token from configured credentials already authenticated via OpenHIM. |
| Justification | To allow client to find existing registered patient from other facilities so they may pull down their demographics for use in their registration process.                                                                                                                                                                                   |


### SYNC - Query for FHIR resources

Requests sent to this endpoint will be forwarded to HAPI FHIR. Whenever an mdm query param is supplied then we perform a OAuth2 authenticated GET request to the MPI endpoint in order to get all the linked patient records (Feature is identical to [HAPI MDM Search Expansion](https://hapifhir.io/hapi-fhir/docs/server_jpa_mdm/mdm_expansion.html)) and we forward the request to HAPI FHIR without the ":mdm" query param.

| Endpoint      | GET /fhir/?.\*                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Body          | none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Response      | FHIR bundle                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Details       | This query is authenticated by the OpenHIM and passed to the Access Proxy. The proxy is a place to restrict access to particular resources and expand queries to consider linked patient records . In this first version all it will do is implement identical functionality to HAPI FHIR’s MDM search expansion except using our external MPI system (we can’t use HAPI FHIR to do this as it uses an internal matching engine where we have an external MPI). Any modified requests and all other requests will be proxied to the HAPI FHIR server. |
| Justification | To allow clients to query back FHIR resources when they already have some information to limit their search, such as a patient ID or other resources references etc.                                                                                                                                                                                                                                                                                                                                                                                   |
