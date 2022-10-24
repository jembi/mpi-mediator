import request from 'request'

import { RequestOptions } from '../types/request';
import { authUserMap } from './register';

export const authenticate = (options: RequestOptions, callback: (error: Error | undefined, body?: any) => void) => {
    const reqOptions = {
        url: `${options.apiURL}/authenticate/${options.username}`,
        rejectUnauthorized: !options.trustSelfSigned
    };

    request.get(reqOptions, (err, resp, body) => {
        if (err) {
            callback(err);
            return;
        }

        if (resp.statusCode !== 200) {
            callback(new Error(`User ${options.username} not found when authenticating with core API`));
            return;
        }

        try {
            body = JSON.parse(body);
            authUserMap.set(options.username, body.salt);
        } catch (err) {
            callback(new Error(`${err}`));
        }

        callback(undefined, resp);
    });
};
