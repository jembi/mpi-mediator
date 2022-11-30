import { expect } from 'chai';
import { Bundle } from 'fhir/r2';
import nock from 'nock';

import { getConfig } from '../../src/config/config';
import { fetchAllPatientResourcesFromFhirDatastore } from '../../src/utils/fhir-datastore';

const config = getConfig();

const { fhirDatastoreProtocol, fhirDatastoreHost, fhirDatastorePort } = config;

const fhirDatastoreUrl = `${fhirDatastoreProtocol}://${fhirDatastoreHost}:${fhirDatastorePort}`;

const fhirBundle: Bundle = {
  resourceType: 'Bundle',
  id: 'bundle-example',
  meta: {
    lastUpdated: '2014-08-18T01:43:30Z',
  },
  type: 'searchset',
  total: 0,
  entry: [],
};

describe('FHIR Datastore', (): void => {
  describe('*fetchAllPatientResourcesFromFhirDatastore', (): void => {
    it('should return a bundle', async (): Promise<void> => {
      nock(fhirDatastoreUrl).get('/fhir/Patient/1/$everything').reply(200, fhirBundle);

      const response = await fetchAllPatientResourcesFromFhirDatastore('Patient/1');

      expect(response).to.deep.equal(fhirBundle);
      nock.cleanAll();
    });

    it('should return undefined when patient is not found', async (): Promise<void> => {
      nock(fhirDatastoreUrl).get('/fhir/Patient/1/$everything').reply(404);

      const response = await fetchAllPatientResourcesFromFhirDatastore('Patient/1');

      expect(response).to.equal(undefined);
      nock.cleanAll();
    });
  });
});
