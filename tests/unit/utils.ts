import { expect } from 'chai';
import nock from 'nock';

import { getConfig } from '../../src/config/config';
import { buildOpenhimResponseObject, getData, postData } from '../../src/routes/utils';
import { OpenHimResponseObject, ResponseObject } from '../../src/types/response';

const config = getConfig();

describe('Utils', (): void => {
  describe('*buildOpenhimResponseObject', (): void => {
    it('should return Object', (): void => {
      const transactionStatus: string = 'Success';
      const httpStatus: number = 200;
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

  describe('*getData', (): void => {
    it('should fail to get when service is down', async (): Promise<void> => {
      const response: ResponseObject = await getData('http', 'test', 2000, 'fhir/Patient');

      expect(response.status).to.equal(500);
      expect(response.body).to.have.property('error');
    });

    it('should get data', async (): Promise<void> => {
      const protocol: string = 'http';
      const host: string = 'example';
      const port: number = 3000;
      const path: string = 'fhir/Patient';
      const dataReturned: object = {
        id: 'patient-id',
      };

      nock(`http://${host}:${port}`).get(`/${path}`).reply(200, dataReturned);

      const response: ResponseObject = await getData(protocol, host, port, path);

      expect(response.status).to.equal(200);
      expect(response.body).to.deep.equal(dataReturned);
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
      const protocol: string = 'http';
      const host: string = 'example';
      const port: number = 3000;
      const path: string = 'fhir';
      const contentType: string = 'application/json';
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
