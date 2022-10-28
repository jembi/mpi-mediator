import fs from 'fs';

import logger from '../logger';
import { MediatorConfig } from '../types/mediatorConfig';
import { RequestOptions } from '../types/request';
import { validateConfiguration } from './validate-config';
import { OPENHIM_PASSWORD, OPENHIM_MEDIATOR_URL, OPENHIM_USERNAME, TRUST_SELF_SIGNED } from '../config/config';

// @ts-ignore
import { activateHeartbeat, fetchConfig, registerMediator } from 'openhim-mediator-utils';

const resolveMediatorConfig = (mediatorConfigFilePath: string) => {
    let mediatorConfig: MediatorConfig;
    try {
        const mediatorConfigFile = fs.readFileSync(mediatorConfigFilePath);

        mediatorConfig = JSON.parse(mediatorConfigFile.toString());
        validateConfiguration(mediatorConfig);
    } catch (error) {
        throw error;
    }

    return mediatorConfig;
};

const resolveOpenhimConfig = (mediatorConfig: MediatorConfig) => {
    return {
        apiURL: OPENHIM_MEDIATOR_URL,
        password: OPENHIM_PASSWORD,
        username: OPENHIM_USERNAME,
        trustSelfSigned: TRUST_SELF_SIGNED,
        urn: mediatorConfig.urn
    };
};

export const mediatorSetup = (mediatorConfigFilePath: string) => {
    let mediatorConfig: MediatorConfig;
    let openhimConfig: RequestOptions;
    try {
        mediatorConfig = resolveMediatorConfig(mediatorConfigFilePath);
        openhimConfig = resolveOpenhimConfig(mediatorConfig);
    } catch (error) {
        logger.error(`Failed to parse JSON in mediatorConfig.json: ${error}`);
        throw error;
    }


    registerMediator(openhimConfig, mediatorConfig, (error: Error) => {
        if (error) {
            logger.error(`Failed to register mediator: ${error.message}`);
            throw error;
        }

        logger.info('Successfully registered mediator!');

        fetchConfig(openhimConfig, (err: Error) => {
            if (err) {
                logger.error(`Failed to fetch initial config: ${error}`);
                throw err;
            }

            const emitter = activateHeartbeat(openhimConfig);
            emitter.on('error', (err2: Error) => {
                logger.error(`Heartbeat failed: ${JSON.stringify(err2)}`);
            });
        });
    });
};
