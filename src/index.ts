import * as express from 'express';
import * as http from 'http';

import * as bodyParser from 'body-parser';
import * as cors from 'cors';
import * as morgan from 'morgan';
import * as compression from 'compression';
import * as methodOverride from 'method-override';
import * as errorHandler from 'errorhandler';
import * as passport from 'passport';

import * as config from './config/environment';
import routing from './routes';
import { initializeSocket, io, setupIo } from './config/socket';
import { worldData } from './api/world/worldData';
import { logger } from './logger';
import { scoreTracker } from './api/player/playerScore';
import { townQueue } from './api/townQueue';

const app = express();
const env = app.get('env');
const server = http.createServer(app);
const worldName = 'megapolis';

setupIo(server);
server.listen(config.port);

app.use(compression());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(methodOverride());
app.use(passport.initialize());
app.use(morgan('dev'));
app.use(cors());
routing(app);

worldData.initialize(worldName)
  .then(() => scoreTracker.readScores())
  .then(() => townQueue.loadQueues())
  .then(() => initializeSocket(io))
  .then(() => {
    if (!worldData.world || !worldData.units.length || !worldData.buildings.length) {
      throw new Error('Missing world data, please check database.');
    }
    logger.info('server ready!');
  })
  .catch((err) => {
    logger.error(err, 'server dead');
    process.exit(1);
  });

if (env === 'development' || env === 'test') {
  app.use(errorHandler({ log: errorNotification }));
}

function errorNotification(err, str, req) {
  logger.error(err, 'unhandled error', str, req);
  return null;
}
