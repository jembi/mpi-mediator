import path from 'path';
import rewire from 'rewire';
import { expect } from 'chai';
import { describe, it } from 'mocha';

import { MediatorConfig } from '../../types/mediatorConfig';
import { RequestOptions } from '../../types/request'
import { OPENHIM_PASSWORD, OPENHIM_MEDIATOR_URL, OPENHIM_USERNAME, TRUST_SELF_SIGNED } from '../../config/config'

const expectedMediatorConfig: MediatorConfig = {
    urn: 'urn:mediator:mpi-checker',
    version: '1.0.0',
    name: 'MPI checker',
    description: "Mediator that checks the existence of a patient in the Client Registry before sending the patient's clinical data to the Fhir Server. It also creates if the pateint resource does not exist",
    defaultChannelConfig: [
        {
            name: 'MPI checker',
            urlPattern: '^/fhir$',
            routes: [
                {
                    name: "MPI Endpoint",
                    host: "mpi-checker-mediator",
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
            host: 'mpi-checker-mediator',
            path: '/fhir',
            port: '3000',
            primary: true,
            type: 'http'
        }
    ],
    configDefs: []
}

const expectedRequestOptions: RequestOptions = {
    username: OPENHIM_USERNAME,
    password: OPENHIM_PASSWORD,
    apiURL: OPENHIM_MEDIATOR_URL,
    trustSelfSigned: TRUST_SELF_SIGNED,
    urn: 'urn:mediator:mpi-checker'
}

describe('Unit tests for src/openhim/openhim.ts', function () {
    var openhimModule = rewire(path.resolve(__dirname, '../../openhim/openhim.ts'))
    const resolveMediatorConfig = openhimModule.__get__("resolveMediatorConfig")
    const resolveOpenhimConfig = openhimModule.__get__("resolveOpenhimConfig")

    describe('Test Resolving of Mediator Config', function () {
        it('Should parse and return the mediatorConfig', () => {
            const mediatorConfig: MediatorConfig = resolveMediatorConfig(path.resolve(__dirname, './mediatorConfig-test.json'))
            expect(mediatorConfig).to.eql(expectedMediatorConfig)
        })
        it('Should Return an Error for Non-Existant File', () => {
            expect(() => resolveMediatorConfig(path.resolve(__dirname, './asdftgsa.json')))
                .to.throw(new RegExp('no such file or directory'))
        })
        it('Should return an error for invalid config file', () => {
            expect(() => { resolveMediatorConfig(path.resolve(__dirname, './mediatorConfig-test-fail.json')) })
                .to.throw(new RegExp('(?=.*invalid config file)(?=.*is not conform to)(?=.*Missing property)'))
        })
    })

    describe('Test Resolving of Openhim Config', function () {
        it('Should Return the RequestOptions Matching expectedCaseTwo', () => {
            const mediatorConfig: MediatorConfig = resolveMediatorConfig(path.resolve(__dirname, './mediatorConfig-test.json'))
            const openhimConfig: RequestOptions = resolveOpenhimConfig(mediatorConfig)
            expect(openhimConfig).to.eql(expectedRequestOptions)
        })
    })
})
