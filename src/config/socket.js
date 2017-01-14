import socketJwt from 'socketio-jwt';
import config from './environment';
import { activeWorlds } from '../components/worlds';
import initializePlayerSocket from '../api/world/player.socket';
import initializeTownSocket from '../api/town/town.socket';
import initializeMapSocket from '../api/map/map.socket';

function onConnect(client) {
  client.log(`${client.username} connected`);
  // Disconnect client if sent world not found
  if (!activeWorlds.has(client.world)) {
    client.log(`${client.username} disconnect, dattempted world: ${client.world}`);
    client.disconnect();
    return;
  }

  initializePlayerSocket(client)
    .then(initializeTownSocket)
    .then(initializeMapSocket)
    .catch(error => {
      console.log(`SOCKET ON CONNECT ERROR ${error}`);
    });
}
function onDisconnect(client) {
  client.log(`${client.username} disconnected`);
}

export default socketio => {
  socketio.use(socketJwt.authorize({
    secret: config.secrets.session,
    handshake: true,
  }));
  socketio.on('connection', client => {
    client.address = `${client.request.connection.remoteAddress}:${client.request.connection.remotePort}`;
    client.connectedAt = new Date();
    client.world = client.handshake.query.world;
    client.userId = client.decoded_token._id;
    client.username = client.decoded_token.name;
    client.log = (...data) => {
      console.log(`SocketIO ${client.nsp.name} [${client.address}]`, ...data);
    };

    // Call onDisconnect.
    client.on('disconnect', () => {
      onDisconnect(client);
    });

    onConnect(client);
  });
};
