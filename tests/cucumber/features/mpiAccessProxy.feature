Feature: MPI Access Proxy ()
  As a user i want to search for patients matches 

  Scenario: Valid Request
    Given MPI service is up and running
    When a $match search request is sent
    Then a success response is sent back

  Scenario: Invalid Request
    Given MPI service is up and running
    When an invalid $match search request is sent
    Then an error response is sent back
