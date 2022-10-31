Feature: OpenHIM Registration
  On startup the mediator should be registered to OpenHIM

  Scenario: Registering a Mediator
    Given the OpenHIM Core service is up and running
    When the mediatorSetup function is run
    Then the OpenHIM Core service should have a registered mediator
    Then the registered mediator should be deleted
