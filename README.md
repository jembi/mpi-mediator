# mpi-mediator
An OpenHIM mediator to handle all interactions with an MPI component  and Hapi Fhir

# Testing

There are two types of tests, unit and integration. The integration tests are done using the [Cucumber](https://cucumber.io/) framework. For the integration tests, the FHIR Datastore service has to be running, and the fhir datastore host and port have to be specified in the `/src/config/config` file, or via environment variables **FHIR_DATASTORE_HOST** and  **FHIR_DATASTORE_PORT**.

Run the commands below to test

```sh
npm run test:unit      // Unit tests

npm run test:cucumber  // Integration tests
```
