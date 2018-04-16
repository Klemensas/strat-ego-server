import * as socketJwt from 'socketio-jwt';
import * as socket from 'socket.io';
import * as http from 'http';
import * as uws from 'uws';
import { AlliancePermissions } from 'strat-ego-common';

import * as config from './environment';
import { PlayerSocket } from '../api/player/player.socket';
import { AllianceSocket } from '../api/alliance/alliance.socket';
import { TownSocket } from '../api/town/town.socket';
import { MapSocket } from '../api/map/map.socket';
import { logger } from '../logger';
import { serializeError } from '../errorSerializer';
import { RankingsSocket } from '../api/player/rankings.socket';

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

export let io: socket.Server;

export const setupIo = (server: http.Server) => {
  io = socket(server, {
    path: '/socket.io-client',
    serveClient: config.env !== 'production',
  });
  io.engine.ws = new uws.Server({
    noServer: true,
    perMessageDeflate: false,
  });
};

export function initializeSocket(socketio: SocketIO.Server) {
    socketio.use(socketJwt.authorize({
      secret: config.secrets.session,
      handshake: true,
    }));
    socketio.on('connection', setupUserSocket);
}

export function setupUserSocket(client: UserSocket) {
  client.address = `${client.request.connection.remoteAddress}:${client.request.connection.remotePort}`;
  client.userData = {
    worldName: client.handshake.query.world,
    userId: client.decoded_token.id,
    username: client.decoded_token.name,
    connectedAt: Date.now(),
  };
  client.log = (data) => logger.error(serializeError(data), `SocketIO ${client.nsp.name} [${client.address}]`);
  client.handleError = (err: Error, type: string, target?: string, payload?: any) => {
    const message = err && typeof err.toString === 'function' ? err.toString() : err;
    const error = {
      type,
      error: message,
      data: payload,
    };

    client.log(error);
    if (target) {
      client.emit(target, error);
    }
  };
  client.on('disconnect', () => {
    client.log(`${client.userData.username} disconnected`);
  });

  return PlayerSocket.onConnect(client)
    .then(() => TownSocket.onConnect(client))
    .then(() => MapSocket.onConnect(client))
    .then(() => AllianceSocket.onConnect(client))
    .then(() => RankingsSocket.onConnect(client))
    .then(() => client.log(`${client.userData.username} connected`));
}
