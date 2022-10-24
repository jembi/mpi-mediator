import fs from 'fs'
import path from 'path'

import logger from '../logger'
import { MediatorConfig } from '../types/mediatorConfig'
import { RequestOptions } from '../types/request'
import { registerMediator } from '../utils/register'
import { fetchConfig, activateHeartbeat } from '../utils/heartbeat'
import { OPENHIM_PASSWORD, OPENHIM_MEDIATOR_URL, OPENHIM_USERNAME, TRUST_SELF_SIGNED } from '../config/config'

export const mediatorSetup = () => {
    const mediatorConfigFile = fs.readFileSync(path.resolve(__dirname,'./mediatorConfig.json'))

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

    registerMediator(openhimConfig, mediatorConfig, (error) => {
        if (error) {
            logger.error(`Failed to register mediator with: ${error.message}`)
            throw error
        }

        logger.info('Successfully registered mediator!')

        fetchConfig(openhimConfig, (err) => {
            if (err) {
                logger.error(`Failed to fetch initial config: ${error}`)
                throw err
            }

            const emitter = activateHeartbeat(openhimConfig)
            emitter.on('error', (err2) => {
                logger.error(`Heartbeat failed: ${JSON.stringify(err2)}`)
            })
        })
    })
}
