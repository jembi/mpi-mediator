Feature: MPI Authentication
    As a user I want to be authenticated when requesting MPI for patients

    Scenario: Post without body
        Given MPI client registry service is up and running
        When a post request without body was sent to get patients
        Then we should get an error response

    Scenario: Post with body
        Given MPI client registry service is up and running
        When a post request with body was sent to get patients
        Then a response should be sent back
