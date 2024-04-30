Feature: FHIR Access Proxy
  As a user I want to get everything related to a specific patient 

  Scenario: Valid $everything Request
    Given MPI and FHIR services are up and running
    When there is data
    And an $everything search request is sent
    Then a successful response containing a bundle of related patient resources is sent back

  Scenario: Valid $everything Request without MDM
    Given MPI and FHIR services are up and running
    When an $everything search request is sent without the MDM param
    Then a successful response containing a bundle is sent back

  Scenario: Valid MDM Request
    Given MPI and FHIR services are up and running
    When an MDM search request is sent
    Then a successful MDM response is sent back
