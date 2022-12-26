Feature: 
As a user I want to send a fhir Patient resource and validate it before sending it to SanteMPI

 Scenario: Send patient resource to MPI
    Given the fhir datastore and the client registry are up and running
    When a patient resource is sent to the MPI mediator
    Then a patient should be created on the client registry

  Scenario: Send an invalid patient to MPI
    Given the fhir datastore and the client registry are up and running
    When an invalid patient resource sent to the MPI mediator
    Then an error, indicating the resource is invalid, should be sent back

 Scenario: Send a valid patient resource to MPI
    Given the fhir datastore and the client registry are up and running
    When a valid patient resource is sent to the MPI mediator
    Then a response, indicating the clinical data has been stored, should be sent back
