import * as socketJwt from 'socketio-jwt';
import config from './environment';
import WorldData from '../components/world';
import initializePlayerSocket from '../api/world/player.socket';
import initializeTownSocket from '../api/town/town.socket';
import initializeMapSocket from '../api/map/map.socket';
import { logger } from '../';

function onConnect(client) {
  client.log(`${client.username} connected`);
  // Disconnect client if sent world not found
  if (WorldData.world.name === client.world) {
    client.log(`${client.username} disconnect, dattempted world: ${client.world}`);
    client.disconnect();
    return;
  }

  initializePlayerSocket(client)
    .then(initializeTownSocket)
    .then(initializeMapSocket)
    .catch((err) => client.log(err, 'SOCKET INIT ERROR'));
}
function onDisconnect(client) {
  client.log(`${client.username} disconnected`);
}

export default (socketio) => {
  socketio.use(socketJwt.authorize({
    secret: config.secrets.session,
    handshake: true,
  }));
  socketio.on('connection', (client) => {
    client.address = `${client.request.connection.remoteAddress}:${client.request.connection.remotePort}`;
    client.connectedAt = new Date();
    client.world = client.handshake.query.world;
    client.userId = client.decoded_token.id;
    client.username = client.decoded_token.name;
    client.log = (...data) => {
      logger.error(...data, `SocketIO ${client.nsp.name} [${client.address}]`);
    };

    // Call onDisconnect.
    client.on('disconnect', () => {
      onDisconnect(client);
    });

    onConnect(client);
  });
};
