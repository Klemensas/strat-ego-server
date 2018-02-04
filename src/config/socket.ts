import * as socketJwt from 'socketio-jwt';
import config from './environment';
import { WorldDataService, WorldData } from '../components/world';
import { PlayerSocket } from '../api/world/player.socket';
import { AllianceSocket } from '../api/alliance/alliance.socket';
import { TownSocket } from '../api/town/town.socket';
import { MapSocket } from '../api/map/map.socket';
import { logger } from '../';
import { Player } from 'api/world/player.model';
import { AlliancePermissions } from 'api/alliance/allianceRole.model';

export interface AuthenticatedSocket extends SocketIO.Socket {
  decoded_token: {
    id: number;
    name: string;
  };
}

export interface UserSocket extends AuthenticatedSocket {
  address: string;
  userData: {
    worldName?: string;
    userId?: number;
    username?: string;
    playername?: string;
    playerId?: number;
    townIds?: number[];
    AllianceId?: number;
    AllianceRoleId?: number;
    AlliancePermissions?: AlliancePermissions;
    updatedAt?: Date | string;
    connectedAt?: Date;
  };
  log(...data: any[]): void;
}

export function initializeSocket(socketio: SocketIO.Server) {
    socketio.use(socketJwt.authorize({
      secret: config.secrets.session,
      handshake: true,
    }));
    socketio.on('connection', setupUserSocket);
}

export function setupUserSocket(socket: UserSocket) {
  socket.address = `${socket.request.connection.remoteAddress}:${socket.request.connection.remotePort}`;
  socket.log = (...data) => logger.error(...data, `SocketIO ${socket.nsp.name} [${socket.address}]`);
  socket.userData = {
    worldName: socket.handshake.query.world,
    userId: socket.decoded_token.id,
    username: socket.decoded_token.name,
    connectedAt: new Date(),
  };
  console.log('socket logged in', socket.userData);

  socket.on('disconnect', () => {
    socket.log(`${socket.userData.username} disconnected`);
  });

  return PlayerSocket.onConnect(socket)
    .then(() => TownSocket.onConnect(socket))
    .then(() => MapSocket.onConnect(socket))
    .then(() => AllianceSocket.onConnect(socket))
    .then(() => socket.log(`${socket.userData.username} connected`));
}

//   export class UserSocket {
//   data: {
//     worldName: string;
//     userId: number;
//     username: string;
//     playername: string;
//     playerId: number;
//     townIds: number[];
//     AllianceId: number;
//     AllianceRoleId: number;
//     AlliancePermissions: AlliancePermissions;
//     updatedAt: Date;
//     connectedAt: Date;
//   };

//   socket: AuthenticatedSocket;
//   private address: string;
//   private log: any;
//   private worldData: WorldData;

//   constructor(socket: AuthenticatedSocket, worldData: WorldData, log: any) {
//     socket.
//     this.socket = socket;
//     this.log = log;
//     this.worldData = worldData;

//     this.address = `${socket.request.connection.remoteAddress}:${socket.request.connection.remotePort}`;
//     this.updateData({
//       connectedAt: new Date(),
//       worldName: socket.handshake.query.world,
//       userId: socket.decoded_token.id,
//       username: socket.decoded_token.name,
//     });
//   }

//   updateData(data: any) {
//     this.data = {
//       ...this.data,
//       ...data,
//     };
//   }

//   logMessage(...data) {
//     this.log.error(...data, `SocketIO ${this.socket.nsp.name} [${this.address}]`);
//   }

//   private onConnect() {
//     if (this.worldData.world.name.toLowerCase() !== this.data.worldName.toLowerCase()) {
//       this.socket.disconnect();
//       return;
//     }

//     this.logMessage(`${this.data.username} connected`);

//     PlayerSocket.onConnect(this)
//       .then(() => TownSocket.onConnect(this))
//       .then(() => MapSocket.onConnect(this.socket));
//     // )
//   }

//   private onDisconnect() {
//     this.logMessage(`${this.data.username} disconnected`);
//   }

// }

// function onConnect(client: UserSocket) {
//   client.log(`${client.username} connected`);
//   // Disconnect client if sent world not found
//   if (WorldDataService.world.name.toLowerCase() === client.world.toLowerCase()) {
//     client.log(`${client.username} disconnect, dattempted world: ${client.world}`);
//     client.disconnect();
//     return;
//   }

//   initializePlayerSocket(client)
//     .then(initializeTownSocket)
//     .then(initializeMapSocket)
//     .then(initializeAllianceSocket)
//     .catch((err) => client.log(err, 'SOCKET INIT ERROR'));
// }
