Feature: FHIR Access Proxy ()
  As a user i want to get everything related to a specific patient 

  Scenario: Valid $everything Request
    Given MPI and FHIR services are up and running
    When a $everything search request is sent
    Then a successful response containing a bundle is sent back

  Scenario: Valid MDM Request
    Given MPI and FHIR services are up and running
    When an MDM search request is sent
    Then a successful MDM response is sent back
