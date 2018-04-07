import * as bunyan from 'bunyan';

export const logger = bunyan.createLogger({
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
