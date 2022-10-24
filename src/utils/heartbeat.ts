import request from 'request'
import events from 'events'

import { RequestOptions } from "../types/request";
import { authenticate } from "./authenticate";
import { genAuthHeaders } from "./register"

const emitter = new events.EventEmitter();
let timer: NodeJS.Timeout;

const sendHeartbeat = (options: RequestOptions, forceConfig: boolean, callback?: (error: Error | undefined, body?: any) => void) => {
    const reqOptions = {
        url: `${options.apiURL}/mediators/${options.urn}/heartbeat`,
        headers: genAuthHeaders(options),
        body: { uptime: process.uptime(), config: false },
        json: true,
        rejectUnauthorized: !options.trustSelfSigned
    };

    if (forceConfig === true) {
        reqOptions.body.config = true;
    }

    request.post(reqOptions, (err: Error, res, body) => {
        if (err) {
            if (callback) {
                return callback(err);
            } else {
                return emitter.emit('error', err);
            }
        }
        if (res.statusCode !== 200) {
            const error: Error = new Error(`Heartbeat unsuccessful with status code of ${res.statusCode}`);
            if (callback) {
                return callback(error);
            } else {
                return emitter.emit('error', error);
            }
        }
        if (body && body !== 'OK') {
            if (callback) {
                return callback(body);
            } else {
                return emitter.emit('config', body);
            }
        } else {
            if (callback) {
                return callback(undefined);
            }
        }
    });
}

export const activateHeartbeat = (options: RequestOptions, interval?: number) => {
    interval = interval || 10000;

    authenticate(options, (err) => {
        if (err) {
            return emitter.emit('error', err);
        }
        if (timer) {
            clearInterval(timer);
        }
        timer = setInterval(() => {
            sendHeartbeat(options, false);
        }, interval);
    });

    return emitter;
};

export const fetchConfig = (options: RequestOptions, callback: ((error?: Error) => void)) => {
    authenticate(options, (err) => {
        if (err) {
            return callback(err);
        }

        sendHeartbeat(options, true, callback);
    });
};
