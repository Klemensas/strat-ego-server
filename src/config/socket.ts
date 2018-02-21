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
    playerName?: string;
    playerId?: number;
    townIds?: number[];
    allianceId?: number;
    allianceName?: string;
    allianceRoleId?: number;
    alliancePermissions?: AlliancePermissions;
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
