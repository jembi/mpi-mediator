import { expect } from 'chai';
import nock from 'nock';

import { getConfig } from '../../src/config/config';
import { buildOpenhimResponseObject, postData } from '../../src/routes/utils';
import { OpenHimResponseObject, PostResponseObject } from '../../src/types/response';

const config = getConfig();

describe('Utils', () : void => {
  describe('*buildOpenhimResponseObject', () : void => {
    it('should return Object', () : void => {
      const transactionStatus : string = 'Success';
      const httpStatus : number = 200;
      const body : object = {
        message: 'Success'
      };
      const contentType : string = 'application/json';
      
      const returnedObect : OpenHimResponseObject = buildOpenhimResponseObject(
        transactionStatus,
        httpStatus,
        body,
        contentType
      );

      expect(returnedObect['x-mediator-urn']).to.equal(config.mediatorUrn);
      expect(returnedObect.status).to.equal(transactionStatus);
      expect(returnedObect.response).to.have.property('timestamp');
      expect(returnedObect.response.headers).to.deep.equal({
        'content-type': contentType
      });
      expect(returnedObect.response.body).to.deep.equal(body);
    });
  });

  describe('*postData', () : void => {
    it('should fail to post when service being posted to is down', async () : Promise<void> => {
      const response : PostResponseObject = await postData('http', 'test', 2000, '', 'application/json', 'data')

      expect(response.status).to.equal(500);
      expect(response.body).to.have.property('error');
    });

    it('should post data', async () : Promise<void> => {
      const protocol : string = 'http';
      const host : string = 'example';
      const port : number = 3000;
      const path : string = 'fhir';
      const contentType : string = 'application/json';
      const data = JSON.stringify({
        data: 'data'
      });
      const dataReturned : object = {
        message: 'Success'
      };

      nock(`http://${host}:${port}`)
        .post(`/${path}`)
        .reply(200, {
          message: 'Success'
        });
      
      const response : PostResponseObject = await postData(protocol, host, port, path, contentType, data);

      expect(response.status).to.equal(200);
      expect(response.body).to.deep.equal(dataReturned);
    });
  });
});
