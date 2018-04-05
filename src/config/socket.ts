import * as socketJwt from 'socketio-jwt';
import { AlliancePermissions } from 'strat-ego-common';

import * as config from './environment';
import { PlayerSocket } from '../api/player/player.socket';
import { AllianceSocket } from '../api/alliance/alliance.socket';
import { TownSocket } from '../api/town/town.socket';
import { MapSocket } from '../api/map/map.socket';
import { logger } from '../';
import { serializeError } from '../errorSerializer';

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
    updatedAt?: number;
    connectedAt?: number;
  };
  log(...data: any[]): void;
  handleError(err: any, type: string, target?: string, payload?: any): void;
}

export class ErrorMessage extends Error {
  constructor(private error: string) {
    super(error);
  }

  toString() { return this.error; }
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
  socket.userData = {
    worldName: socket.handshake.query.world,
    userId: socket.decoded_token.id,
    username: socket.decoded_token.name,
    connectedAt: Date.now(),
  };
  socket.log = (data) => logger.error(serializeError(data), `SocketIO ${socket.nsp.name} [${socket.address}]`);
  socket.handleError = (err: Error, type: string, target?: string, payload?: any) => {
    const message = err && typeof err.toString === 'function' ? err.toString() : err;
    const error = {
      type,
      error: message,
      data: payload,
    };

    socket.log(error);
    if (target) {
      socket.emit(target, error);
    }
  };
  socket.on('disconnect', () => {
    socket.log(`${socket.userData.username} disconnected`);
  });

  return PlayerSocket.onConnect(socket)
    .then(() => TownSocket.onConnect(socket))
    .then(() => MapSocket.onConnect(socket))
    .then(() => AllianceSocket.onConnect(socket))
    .then(() => socket.log(`${socket.userData.username} connected`));
}
