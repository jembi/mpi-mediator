import logger from '../logger';
import { MediatorConfig } from '../types/mediatorConfig';
import { RequestOptions } from '../types/request';
import { getConfig } from '../config/config';

// @ts-ignore
import { activateHeartbeat, fetchConfig, registerMediator } from 'openhim-mediator-utils';

const resolveMediatorConfig = (mediatorConfigFilePath: string) => {
    let mediatorConfig: MediatorConfig;
    try {
        const mediatorConfigFile = require(mediatorConfigFilePath);

        mediatorConfig = JSON.parse(JSON.stringify(mediatorConfigFile));
    } catch (error) {
        throw error;
    }

    return mediatorConfig;
};

const resolveOpenhimConfig = (mediatorConfig: MediatorConfig) => {
    const config = getConfig();

    return {
        username: config.openhimUsername,
        password: config.openhimPassword,
        apiURL: config.openhimMediatorUrl,
        trustSelfSigned: config.trustSelfSigned,
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
        logger.error(`Failed to parse JSON: ${error}`);
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
