import { expect } from 'chai';
import nock from 'nock';

import { getConfig } from '../../src/config/config';
import { buildOpenhimResponseObject, postData } from '../../src/routes/utils';
import { OpenHimResponseObject, ResponseObject } from '../../src/types/response';

const config = getConfig();

describe('Utils', (): void => {
  describe('*buildOpenhimResponseObject', (): void => {
    it('should return Object', (): void => {
      const transactionStatus = 'Success';
      const httpStatus = 200;
      const body: object = {
        message: 'Success',
      };
      const contentType: string = 'application/json';

      const returnedObject: OpenHimResponseObject = buildOpenhimResponseObject(
        transactionStatus,
        httpStatus,
        body,
        contentType
      );

      expect(returnedObject['x-mediator-urn']).to.equal(config.mediatorUrn);
      expect(returnedObject.status).to.equal(transactionStatus);
      expect(returnedObject.response).to.have.property('timestamp');
      expect(returnedObject.response.headers).to.deep.equal({
        'content-type': contentType,
      });
      expect(returnedObject.response.body).to.deep.equal(body);
    });
  });

  describe('*postData', (): void => {
    it('should fail to post when service being posted to is down', async (): Promise<void> => {
      const response: ResponseObject = await postData(
        'http',
        'test',
        2000,
        '',
        'application/json',
        'data'
      );

      expect(response.status).to.equal(500);
      expect(response.body).to.have.property('error');
    });

    it('should post data', async (): Promise<void> => {
      const protocol = 'http';
      const host = 'example';
      const port = 3000;
      const path = 'fhir';
      const contentType = 'application/json';
      const data = JSON.stringify({
        data: 'data',
      });
      const dataReturned: object = {
        message: 'Success',
      };

      nock(`${protocol}://${host}:${port}`).post(`/${path}`).reply(200, {
        message: 'Success',
      });

      const response: ResponseObject = await postData(
        protocol,
        host,
        port,
        path,
        contentType,
        data
      );

      expect(response.status).to.equal(200);
      expect(response.body).to.deep.equal(dataReturned);
    });
  });
});
