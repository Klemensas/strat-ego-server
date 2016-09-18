import config from './environment';
import { activeWorlds } from '../components/worlds';
import { register as worldSocket } from '../api/world/world.socket';
import { world } from '../sqldb';

const Player = world.Player;
const Town = world.Town;

// When the user disconnects.. perform this
function onDisconnect(socket) {
}

// When the user connects.. perform this
function onConnect(client) {
  // Disconnect client if sent world not found
  if (!activeWorlds.has(client.world)) {
    client.disconnect();
    return;
  }

  client.log('shmuck logged in', client.decoded_token.name);
  worldSocket(client);
}

module.exports = socketio => {
  // socket.io (v1.x.x) is powered by debug.
  // In order to see all the debug output, set DEBUG (in server/config/local.env.js) to including the desired scope.
  // ex: DEBUG: "http*,socket.io:socket"

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
      console.log('Disconnected');
    });

    Player.findOne({
      where: {
        UserId: client.decoded_token._id,
      },
      include: {
        model: Town,
      },
    })
    .then(player => {
      client.player = player;
      onConnect(client);
    })
    .catch(player => {
      console.log('real error', player);
      // handle crash;
    });
  });
};
