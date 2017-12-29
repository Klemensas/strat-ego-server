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

import config from './config/environment';
import { main, world } from './sqldb';
import seedWorld from './sqldb/seed';
import WorldData from './components/world';
import MapManager from './components/map';
import routing from './routes';
import initSocket from './config/socket';
import queue from './api/world/queue';

const app = express();
const env = app.get('env');
const server = http.createServer(app);
const worldName = 'Megapolis';

export const logger = bunyan.createLogger({
  name: 'app',
  streams: [{
    level: 'info',
    stream: process.stdout,
  }, {
    level: 'error',
    path: 'error.log',
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
  .then(() => WorldData.readWorld(worldName))
  .then(() => MapManager.initialize(worldName))
  .then(() => initSocket(io))
  .then(() => logger.info('server ready!'))
  .then(() => queue.go());

if (env === 'development' || env === 'test') {
  app.use(statusMonitor());
  app.use(errorHandler({ log: errorNotification }));
}

function errorNotification(err, str, req) {
  logger.error(err, 'unhandled error', str, req);
  return null;
}