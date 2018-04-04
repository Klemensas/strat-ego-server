import * as express from 'express';
import * as http from 'http';
import * as socket from 'socket.io';
import * as uws from 'uws';

import * as bodyParser from 'body-parser';
import * as cors from 'cors';
import * as morgan from 'morgan';
import * as compression from 'compression';
import * as methodOverride from 'method-override';
import * as errorHandler from 'errorhandler';
import * as passport from 'passport';
import * as bunyan from 'bunyan';

import * as statusMonitor from 'express-status-monitor';

import * as config from './config/environment';
import { main, world } from './sqldb';
import seedWorld from './sqldb/seed';
import routing from './routes';
import { initializeSocket } from './config/socket';
import { worldData } from './api/world/worldData';
import { mapManager } from './api/map/mapManager';
// import queue from './api/world/queue';

const app = express();
const env = app.get('env');
const server = http.createServer(app);
const worldName = 'megapolis';

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

export const io = socket(server, {
  path: '/socket.io-client',
  serveClient: config.env !== 'production',
});
io.engine.ws = new uws.Server({
  noServer: true,
  perMessageDeflate: false,
});
server.listen(config.port);

app.use(compression());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(methodOverride());
app.use(passport.initialize());
app.use(morgan('dev'));
app.use(cors());
routing(app);

main.sequelize.sync()
  .then(() => world.sequelize.sync())
  .then(() => (config.seedDB ? seedWorld() : null))
  .then(() => worldData.readWorld(worldName))
  .then(() => mapManager.initialize(worldName))
  .then(() => initializeSocket(io))
  .then(() => logger.info('server ready!'));
  // .then(() => queue.go());

if (env === 'development' || env === 'test') {
  app.use(statusMonitor());
  app.use(errorHandler({ log: errorNotification }));
}

function errorNotification(err, str, req) {
  logger.error(err, 'unhandled error', str, req);
  return null;
}
