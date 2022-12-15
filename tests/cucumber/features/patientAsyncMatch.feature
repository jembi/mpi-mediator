Feature: Asynchronous Patient matching
  As a user I want to send a fhir bundle and validate it before sending it to Kafka for asynchronous matching

  Scenario: Send invalid fhir bundle
    Given the mediator is up and running
    When an invalid fhir bundle is sent to the MPI mediator
    Then an invalid fhir bundle response should be sent back

  Scenario: Send valid fhir bundle
    Given the mediator is up and running
    When a valid fhir bundle is sent, and forwarded to kafka
    Then a response, indicating success, should be sent back
