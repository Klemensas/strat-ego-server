import express from 'express';
import { main, world } from './sqldb';
import config from './config/environment';
import http from 'http';
import initSocket from './config/socket';
import { mapData } from './config/game/map';
// import * as redis from 'redis';
// import * as bluebird from 'bluebird';

// bluebird.promisifyAll(redis.RedisClient.prototype);
// bluebird.promisifyAll(redis.Multi.prototype);
// import map from './components/map';

// Populate databases with sample data
if (config.seedDB) { require('./config/seed'); }

// Setup server
export const app = express();
const server = http.createServer(app);
export const socket = require('socket.io')(server, {
  serveClient: config.env !== 'production',
  path: '/socket.io-client',
});
initSocket(socket);

require('./config/express')(app);
require('./routes')(app);

// // Start server
function startServer() {
  app.angularFullstack = server.listen(config.port, config.ip, () => {
    console.log('Express server listening on %d, in %s mode', config.port, app.get('env'));
  });
}


main.sequelize.sync()
  .then(() => world.sequelize.sync())
  .then(() => mapData.initialize(/*redis.createClient()*/))
  .then(startServer)
  .then(() => { // TODO: separate this into a startup service

  })
  .catch(err => console.log('Server failed to start due to error: %s', err));
