Feature: Sante Authenticating
    As a user I want to be authenticated when requesting sante for patients

    Scenario: Post without body
        Given SanteMPI client registry service is up and running
        When a post request without body was sent to get patients
        Then a response should be sent back

    Scenario: Post with body
        Given SanteMPI client registry service is up and running
        When a post request with body was sent to get patients
        Then a response should be sent back
