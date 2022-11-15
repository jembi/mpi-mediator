import path from 'path';
import rewire from 'rewire';
import chai, { expect } from 'chai';

import { MediatorConfig } from '../../src/types/mediatorConfig';
import { RequestOptions } from '../../src/types/request';
import { getConfig } from '../../src/config/config';

chai.config.truncateThreshold = 0;

const expectedMediatorConfig: MediatorConfig = {
    urn: 'urn:mediator:mpi-mediator',
    version: '1.0.0',
    name: 'MPI mediator',
    description: "A mediator handling interactions between the OpenHIM Core service, Sante MPI, Hapi-FHIR, and Kafka",
    defaultChannelConfig: [
        {
            name: 'MPI mediator',
            urlPattern: '^/fhir$',
            routes: [
                {
                    name: "MPI Endpoint",
                    host: "mpi-mediator",
                    port: "3000",
                    primary: true,
                    type: "http"
                }
            ],
            allow: ["instant"],
            methods: ["POST"],
            type: 'http'
        }
    ],
    endpoints: [
        {
            name: 'MPI Endpoint',
            host: 'mpi-mediator',
            path: '/fhir',
            port: '3000',
            primary: true,
            type: 'http'
        }
    ],
    configDefs: []
};

const config = getConfig();

const expectedRequestOptions: RequestOptions = {
    username: config.openhimUsername,
    password: config.openhimPassword,
    apiURL: config.openhimMediatorUrl,
    trustSelfSigned: config.trustSelfSigned,
    urn: 'urn:mediator:mpi-mediator'
};

describe('Mediator Registration', () => {
    const openhimModule = rewire(path.resolve(__dirname, '../../src/openhim/openhim.ts'));
    const resolveMediatorConfig = openhimModule.__get__("resolveMediatorConfig");
    const resolveOpenhimConfig = openhimModule.__get__("resolveOpenhimConfig");

    describe('Test Resolving of Mediator Config', () => {
        it('Should parse and return the mediatorConfig', () => {
            const mediatorConfig: MediatorConfig = resolveMediatorConfig(path.resolve(__dirname, './mediatorConfig-test.json'));
            expect(mediatorConfig).to.eql(expectedMediatorConfig);
        });
        it('Should Return an Error for Non-Existant File', () => {
            expect(() => resolveMediatorConfig(path.resolve(__dirname, './asdftgsa.json')))
                .to.throw(new RegExp('Cannot find module'));
        });
    });

    describe('Test Resolving of Openhim Config', () => {
        it('Should Return the RequestOptions Matching expectedRequestOptions', () => {
            const mediatorConfig: MediatorConfig = resolveMediatorConfig(path.resolve(__dirname, './mediatorConfig-test.json'));
            const openhimConfig: RequestOptions = resolveOpenhimConfig(mediatorConfig);
            expect(openhimConfig).to.eql(expectedRequestOptions);
        });
    });
});
