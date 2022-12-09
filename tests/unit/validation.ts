import { expect } from 'chai';
import { Bundle } from 'fhir/r3';
import nock from 'nock';

import { getConfig } from '../../src/config/config';
import { validate } from '../../src/routes/handlers/validation';
import { MpiMediatorResponseObject } from '../../src/types/response';

const config = getConfig();

describe('Validation handler', (): void => {
  describe('*validate', (): void => {
    it('should return error when validating server is unavalaible', async (): Promise<void> => {
      const bundle: Bundle = {
        resourceType: 'Bundle',
        id: 'testBundle',
        type: 'transaction',
        entry: [
          {
            fullUrl: 'Patient/testPatient',
            resource: {
              resourceType: 'Patient',
              id: '123',
            },
            request: {
              method: 'PUT',
              url: 'Patient/testPatient',
            },
          },
        ],
      };
      nock(`http://${config.fhirDatastoreHost}:${config.fhirDatastorePort}`)
        .post('/fhir/Bundle/$validate')
        .reply(500, {});

      const result: MpiMediatorResponseObject = await validate(bundle);

      expect(result.status).to.equal(500);
    });

    it('should succesfully validate', async (): Promise<void> => {
      const bundle: Bundle = {
        resourceType: 'Bundle',
        id: 'testBundle',
        type: 'transaction',
        entry: [
          {
            fullUrl: 'Patient/testPatient',
            resource: {
              resourceType: 'Patient',
              id: '123',
            },
            request: {
              method: 'PUT',
              url: 'Patient/testPatient',
            },
          },
        ],
      };

      nock(`http://${config.fhirDatastoreHost}:${config.fhirDatastorePort}`)
        .post('/fhir/Bundle/$validate')
        .reply(200, {
          message: 'Success',
        });

      const result: MpiMediatorResponseObject = await validate(bundle);

      expect(result.status).to.equal(200);
    });
  });
});
