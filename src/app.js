import express from 'express';
import sqldb from './sqldb';
import config from './config/environment';
import http from 'http';
// import map from './components/map';

// Populate databases with sample data
if (config.seedDB) { require('./config/seed'); }

// Setup server
const app = express();
const server = http.createServer(app);
// var socketio = require('socket.io')(server, {
//   serveClient: config.env !== 'production',
//   path: '/socket.io-client'
// });
// require('./config/socketio')(socketio);
// console.log('yello');

require('./config/express')(app);
require('./routes')(app);

// // Start server
function startServer() {
  app.angularFullstack = server.listen(config.port, config.ip, () => {
    console.log('Express server listening on %d, in %s mode', config.port, app.get('env'));
  });
}

sqldb.main.sequelize.sync()
  .then(() => sqldb.world.sequelize.sync())
  .then(startServer)
  .then(() => { // TODO: separate this into a startup service

  })
  .catch(err => console.log('Server failed to start due to error: %s', err));

// Expose app
export default app;
