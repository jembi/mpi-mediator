// @ts-ignore
import { Given, When, Then } from "cucumber";
import { expect } from "chai";
import path from "path";
import fetch from "node-fetch";
import rewire from 'rewire';
import https from "https";

import { getConfig } from "../../../src/config/config";
import { MediatorConfig } from "../../../src/types/mediatorConfig";
import { mediatorSetup } from "../../../src/openhim/openhim";

process.env.TRUST_SELF_SIGNED = 'true';
process.env.REGISTER_MEDIATOR = 'true';
const config = getConfig();

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

const DeleteMediator = async () => {
  const headers = {} as { [key: string]: string };
  headers.Authorization = 'Basic ' + Buffer.from(config.openhimUsername + ":" + config.openhimPassword).toString('base64');

  const openhimModule = rewire(path.resolve(__dirname, '../../../src/openhim/openhim.ts'));
  const resolveMediatorConfig = openhimModule.__get__("resolveMediatorConfig");

  const mediatorConfig: MediatorConfig = resolveMediatorConfig(path.resolve(__dirname, '../../unit/mediatorConfig-test.json'));

  await fetch(config.openhimMediatorUrl + `/mediators/` + mediatorConfig.urn, {
    agent: httpsAgent,
    headers,
    method: 'DELETE'
  });
};

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

Given("the OpenHIM Core service is up and running", async (): Promise<void> => {
  const response = await fetch(config.openhimMediatorUrl + '/heartbeat', {
    agent: httpsAgent,
  });

  expect(response.status).to.equal(200);
});

When('the mediatorSetup function is run', () => {
  expect(() => mediatorSetup(path.resolve(__dirname, '../../unit/mediatorConfig-test.json'))).to.not.throw();
});

Then('the OpenHIM Core service should have a registered mediator', async () => {
  const headers = {} as { [key: string]: string };
  headers.Authorization = 'Basic ' + Buffer.from(config.openhimUsername + ":" + config.openhimPassword).toString('base64');

  const openhimModule = rewire(path.resolve(__dirname, '../../../src/openhim/openhim.ts'));
  const resolveMediatorConfig = openhimModule.__get__("resolveMediatorConfig");

  await sleep(1000);

  const response = await fetch(config.openhimMediatorUrl + '/mediators', {
    agent: httpsAgent,
    headers
  });

  const respBody: MediatorConfig[] = JSON.parse(JSON.stringify(await response.json()));
  const mediatorConfig: MediatorConfig = resolveMediatorConfig(path.resolve(__dirname, '../../unit/mediatorConfig-test.json'));

  expect(respBody.length).to.eql(1);
  expect(respBody[0].name).to.eql(mediatorConfig.name);

  expect(async () => await DeleteMediator()).to.not.throw();
});

Then('the registered mediator should be deleted', async () => {
  expect(async () => await DeleteMediator()).to.not.throw();
});
