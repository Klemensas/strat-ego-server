import * as socketJwt from 'socketio-jwt';
import * as socket from 'socket.io';
import * as http from 'http';
import * as uws from 'uws';
import { AlliancePermissions } from 'strat-ego-common';

import * as config from './environment';
import { PlayerSocket } from '../api/player/playerSocket';
import { AllianceSocket } from '../api/alliance/allianceSocket';
import { TownSocket } from '../api/town/townSocket';
import { MapSocket } from '../api/map/mapSocket';
import { logger } from '../logger';
import { serializeError } from '../errorSerializer';
import { RankingsSocket } from '../api/ranking/rankingsSocket';
import { ProfileSocket } from '../api/profile/profileSocket';

export interface AuthenticatedSocket extends SocketIO.Socket {
  decoded_token: {
    id: number;
    name: string;
  };
}

export interface SocketUserData {
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
}

export interface UserSocket extends AuthenticatedSocket {
  address: string;
  userData: SocketUserData;
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
  return io;
};

export function initializeSocket(socketio: SocketIO.Server) {
    socketio.use(socketJwt.authorize({
      secret: config.secrets.session,
      handshake: true,
    }));
    socketio.on('connection', setupUserSocket);
}

export async function setupUserSocket(client: UserSocket) {
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

  const player = await PlayerSocket.onConnect(client);
  const [towns, alliance] = await Promise.all([
    TownSocket.onConnect(client),
    AllianceSocket.onConnect(client),
    MapSocket.onConnect(client),
    RankingsSocket.onConnect(client),
    ProfileSocket.onConnect(client),
  ]);

  client.emit('initialize', { player, towns, alliance });
  client.log(`${client.userData.username} connected`);
}
