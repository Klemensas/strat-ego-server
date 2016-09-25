import config from './environment';
import { activeWorlds } from '../components/worlds';
import { initializePlayer } from '../api/world/player.socket';
import { initializeTown } from '../api/town/town.socket';

// When the user disconnects.. perform this

// When the user connects.. perform this
function onConnect(client) {
  client.log('shmuck logged in', client.username);
  // Disconnect client if sent world not found
  if (!activeWorlds.has(client.world)) {
    client.disconnect();
    return;
  }

  initializePlayer(client)
    .then(initializeTown)
    .catch(error => {
      console.log(`SOCKET ON CONNECT ERROR ${error}`);
    })
}
function onDisconnect(client) {
}

export default socketio => {
  socketio.use(require('socketio-jwt').authorize({
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
