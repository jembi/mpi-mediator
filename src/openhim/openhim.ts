import fs from 'fs'
import path from 'path'

import logger from '../logger'
import { MediatorConfig } from '../types/mediatorConfig'
import { RequestOptions } from '../types/request'
import { OPENHIM_PASSWORD, OPENHIM_MEDIATOR_URL, OPENHIM_USERNAME, TRUST_SELF_SIGNED } from '../config/config'

// @ts-ignore
import { activateHeartbeat, fetchConfig, registerMediator } from 'openhim-mediator-utils'

export const mediatorSetup = () => {
    const mediatorConfigFile = fs.readFileSync(path.resolve(__dirname, './mediatorConfig.json'))

    let mediatorConfig: MediatorConfig
    try {
        mediatorConfig = JSON.parse(mediatorConfigFile.toString())
    } catch (error) {
        logger.error(`Failed to parse JSON in mediatorConfig.json`)
        throw error
    }

    const openhimConfig: RequestOptions = {
        apiURL: OPENHIM_MEDIATOR_URL,
        password: OPENHIM_PASSWORD,
        username: OPENHIM_USERNAME,
        trustSelfSigned: TRUST_SELF_SIGNED,
        urn: mediatorConfig.urn
    }

    registerMediator(openhimConfig, mediatorConfig, (error: Error) => {
        if (error) {
            logger.error(`Failed to register mediator: ${error.message}`)
            throw error
        }

        logger.info('Successfully registered mediator!')

        fetchConfig(openhimConfig, (err: Error) => {
            if (err) {
                logger.error(`Failed to fetch initial config: ${error}`)
                throw err
            }

            const emitter = activateHeartbeat(openhimConfig)
            emitter.on('error', (err2: Error) => {
                logger.error(`Heartbeat failed: ${JSON.stringify(err2)}`)
            })
        })
    })
}
