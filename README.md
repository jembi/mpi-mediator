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

Requests sent to this endpoint will be forwarded as a OAuth2 authenticated GET request to the SanteMPI endpoint (http://santedb-mpi/fhir/Patient).

| Endpoint      | POST /fhir/Patient/$match                                                                                                                                                                                                                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Body          | FHIR Parameters object - [see here](https://www.hl7.org/fhir/patient-operation-match.html)                                                                                                                                                                                                                                                  |
| Response      | FHIR bundle with matched master patients                                                                                                                                                                                                                                                                                                    |
| Details       | This query is authenticated by the OpenHIM and passed directly to the active MPI system. In the case of SanteMPI an auth mediator is needed that creates an OAuth access token for SanteMPI using configured credentials as the SanteMPI API requires authentication in this form yet our request is already authenticated via the OpenHIM. |
| Justification | To allow client to find existing registered patient from other facilities so they may pull down their demographics for use in their registration process.                                                                                                                                                                                   |
