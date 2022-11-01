Feature: Bundle Validation
  As a user i want to validate fhir bundles

  Scenario: Invalid Fhir Bundle
    Given the fhir datastore service is up and running
    When an invalid bundle is sent through
    Then an error response should be sent back

  Scenario: Valid Fhir Bundle
    Given the fhir datastore service is up and running
    When a valid bundle is sent through
    Then a success response should be sent back
