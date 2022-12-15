Feature: Synchronous Patient matching
  As a user I want to send a fhir bundle to Kafka and the Fhir datastore, after creating the patient on the Client registry

  Scenario: Send bundle with patient resource to MPI
    Given the fhir datastore, kafka and the client registry are up and running
    When a fhir bundle is send to the MPI mediator
    Then a patient should be created on the client registry
    And it's clinical data should be stored in the fhir datastore

  Scenario: Send bundle with invalid patient reference to MPI
    Given the fhir datastore, kafka and the client registry are up and running
    When a fhir bundle with an invalid patient reference is send to the MPI mediator
    Then an error, indicating the patient does not exist, should be sent back

 Scenario: Send bundle with valid patient reference to MPI
    Given the fhir datastore, kafka and the client registry are up and running
    When a fhir bundle with a valid patient reference is send to the MPI mediator
    Then a response, indicating the clinical data has been stored, should be sent back
