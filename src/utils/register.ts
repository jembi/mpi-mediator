import crypto from 'crypto'
import request from 'request'

import { authenticate } from "./authenticate";
import { MediatorConfig } from "../types/mediatorConfig";
import { RequestOptions } from '../types/request';
import logger from '../logger';

export const authUserMap = new Map();

export const registerMediator = (options: RequestOptions, mediatorConfig: MediatorConfig, callback: (error: Error | undefined) => void) => {
    authenticate(options, (error) => {
        if (error) {
            return callback(error);
        }
        const headers = genAuthHeaders(options);

        const reqOptions = {
            url: `${options.apiURL}/mediators`,
            json: true,
            headers,
            body: mediatorConfig,
            rejectUnauthorized: !options.trustSelfSigned
        };

        request.post(reqOptions, (err: Error, resp: any) => {
            if (err) {
                return callback(err);
            }

            if (resp.statusCode === 201) {
                callback(undefined);
            } else {
                callback(new Error(`Recieved non-201 status code with: ${resp.body}`));
            }
        });
    });
};

export const genAuthHeaders = (options: RequestOptions) => {
    const salt = authUserMap.get(options.username);
    if (salt === undefined) {
        logger.error(`${options.username} has not been authenticated. Please use the .authenticate() function first`)
        throw Error
    }

    const now = new Date().toISOString();

    let shasum = crypto.createHash('sha512');
    shasum.update(salt + options.password);
    const passhash = shasum.digest('hex');

    shasum = crypto.createHash('sha512');
    shasum.update(passhash + salt + now);
    const token = shasum.digest('hex');

    return {
        'auth-username': options.username,
        'auth-ts': now,
        'auth-salt': salt,
        'auth-token': token
    };
};
