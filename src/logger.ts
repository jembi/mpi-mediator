import pino, { stdSerializers } from 'pino';

import { getConfig } from './config/config';

export default pino({
  timestamp: pino.stdTimeFunctions.isoTime,
  level: getConfig().logLevel,
  serializers: {
    err: stdSerializers.err,
  },
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});
