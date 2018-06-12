import * as bunyan from 'bunyan';

import * as config from './config/environment';

let logger;
switch (config.env) {
  case 'test': {
    logger = bunyan.createLogger({ name: 'app', level: 'fatal'  });
    break;
  }
  default:
    logger = bunyan.createLogger({
      name: 'app',
      streams: [{
        level: 'info',
        stream: process.stdout,
      }, {
        level: 'error',
        path: 'error.log',
      }, {
        level: 'error',
        stream: process.stdout,
      }],
    });
}

export { logger };
