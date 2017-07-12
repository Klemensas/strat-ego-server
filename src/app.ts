import express from 'express';
import http from 'http';
import socket from 'socket.io';
import uws from 'uws';
import { main, world } from './sqldb';
import config from './config/environment';
import initSocket from './config/socket';
import mapData from './config/game/map';
import routing from './routes';
import expressConfig from './config/express';
import seed from './config/seed';
import Queue from './api/world/queue';
import { readWorld } from './components/worlds';
// import * as redis from 'redis';

// bluebird.promisifyAll(redis.RedisClient.prototype);
// bluebird.promisifyAll(redis.Multi.prototype);
// import map from './components/map';

export const app = express();
const server = http.createServer(app);
export const io = socket(server, {
  serveClient: config.env !== 'production',
  path: '/socket.io-client',
});
io.engine.ws = new uws.Server({
  noServer: true,
  perMessageDeflate: false
});

expressConfig(app);
routing(app);

main.sequelize.sync()
  .then(() => world.sequelize.sync())
  .then(() => (config.seedDB ? seed() : readWorld('Megapolis')))
  .then(() => mapData.initialize(world))
  .then(worldData => {
    Queue.init();
    initSocket(io);
  })
  .then(() => {
    app.server = server.listen(config.port, config.ip, () => {
      console.log('Express server listening on %d, in %s mode', config.port, app.get('env'));
    });
  }) // TODO: separate this into a startup service
  .catch(err => console.log('Server failed to start due to error: %s', err));
