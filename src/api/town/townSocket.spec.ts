import { transaction } from 'objection';
import { EventEmitter } from 'events';
import * as http from 'http';

import { TownSocket } from './townSocket';
import { Town } from './town';
import { World } from '../world/world';
import { worldData } from '../world/worldData';
import { UserSocket, ErrorMessage, setupIo } from '../../config/socket';
import { townQueue } from '../townQueue';
import * as townQueries from './townQueries';
import { NamePayload, BuildPayload, RecruitPayload, TroopMovementPayload, MovementType } from 'strat-ego-common';
import { InvolvedTownChanges } from './movementResolver';

let socket: UserSocket;
let emitSpy;
beforeEach(() => {
  socket = new EventEmitter() as UserSocket;
  socket.handleError = jest.fn().mockImplementation(() => null);
  socket.join = jest.fn().mockImplementation(() => null);
  socket.userData = {};
  emitSpy = jest.spyOn(TownSocket, 'emitToTownRoom').mockImplementation(() => null);
  emitSpy.mockReset();
  worldData.unitMap = {
    sword: { speed: 1 },
    archer: { speed: 2 },
    horse: { speed: 2 },
  } as any;
  worldData.world = {
    baseProduction: 500,
  } as World;
});

describe('onConnect', () => {
  const testTowns = [{
    id: 11,
    name: 'town',
  }, {
    id: 1234,
    name: 'not a town',
  }];
  const socketEvents = [
    'town:rename',
    'town:build',
    'town:recruit',
    'town:moveTroops',
    'town:recallSupport',
    'town:sendBackSupport',
  ];

  beforeEach(() => {
    jest.spyOn(TownSocket, 'getPlayerTowns').mockImplementation(() => testTowns);
    jest.spyOn(TownSocket, 'joinTownRoom').mockImplementationOnce(() => null);
  });

  it('should register events', async () => {
    expect(socket.eventNames()).toHaveLength(0);
    await TownSocket.onConnect(socket);
    expect(TownSocket.joinTownRoom).toHaveBeenCalledWith(socket);
    expect(socket.eventNames()).toEqual(socketEvents);
  });

  it ('should set user data and return towns', async () => {
    const result = await TownSocket.onConnect(socket);
    expect(socket.userData.townIds).toEqual(testTowns.map(({ id }) => id));
    expect(result).toEqual(testTowns);
  });

  describe('events', () => {
    beforeEach(() => {
      jest.spyOn(TownSocket, 'joinTownRoom').mockImplementationOnce(() => null);
      TownSocket.onConnect(socket);
    });

    it('should call rename on rename emit', () => {
      jest.spyOn(TownSocket, 'rename').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(TownSocket.rename).not.toHaveBeenCalled();

      const payload: NamePayload = { town: 1, name: 'test' };
      socket.emit('town:rename', payload);
      expect(TownSocket.rename).toHaveBeenCalledWith(socket, payload);
    });

    it('should call build on build emit', () => {
      jest.spyOn(TownSocket, 'build').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(TownSocket.build).not.toHaveBeenCalled();

      const payload: BuildPayload = { town: 1, building: 'test' };
      socket.emit('town:build', payload);
      expect(TownSocket.build).toHaveBeenCalledWith(socket, payload);
    });

    it('should call recruit on recruit emit', () => {
      jest.spyOn(TownSocket, 'recruit').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(TownSocket.recruit).not.toHaveBeenCalled();

      const payload: RecruitPayload = { town: 1, units: [{ type: 'test', amount: 1 }] };
      socket.emit('town:recruit', payload);
      expect(TownSocket.recruit).toHaveBeenCalledWith(socket, payload);
    });

    it('should call moveTroops on moveTroops emit', () => {
      jest.spyOn(TownSocket, 'moveTroops').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(TownSocket.moveTroops).not.toHaveBeenCalled();

      const payload: TroopMovementPayload = { town: 1, target: [1, 1], units: { test: 1 }, type: MovementType.attack };
      socket.emit('town:moveTroops', payload);
      expect(TownSocket.moveTroops).toHaveBeenCalledWith(socket, payload);
    });

    it('should call cancelSupport on recallSupport emit', () => {
      jest.spyOn(TownSocket, 'cancelSupport').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(TownSocket.cancelSupport).not.toHaveBeenCalled();

      const payload = 2;
      socket.emit('town:recallSupport', payload);
      expect(TownSocket.cancelSupport).toHaveBeenCalledWith(socket, payload, 'origin');
    });

    it('should call cancelSupport on sendBackSupport emit', () => {
      jest.spyOn(TownSocket, 'cancelSupport').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(TownSocket.cancelSupport).not.toHaveBeenCalled();

      const payload = 2;
      socket.emit('town:sendBackSupport', payload);
      expect(TownSocket.cancelSupport).toHaveBeenCalledWith(socket, payload, 'target');
    });
  });
});

it('joinTownRoom should call join for every user town', () => {
  socket.userData.townIds = [];
  TownSocket.joinTownRoom(socket);
  expect(socket.join).not.toHaveBeenCalled();

  socket.userData.townIds = [564, 56, 11];
  TownSocket.joinTownRoom(socket);
  expect(socket.join).toHaveBeenCalledTimes(socket.userData.townIds.length);
  expect(socket.join).toHaveBeenLastCalledWith(`town.${socket.userData.townIds[socket.userData.townIds.length - 1]}`);
});

describe('io', () => {
  let io;
  let rooms;
  let sockets;
  beforeEach(() => {
    const server = http.createServer();
    io = setupIo(server);
    sockets = {};
    rooms = {};
    io.sockets = {
      adapter: {
        rooms,
      },
      connected: sockets,
    } as any;
  });

  describe('clearTownRoom', () => {
    it('should exit cleanly if room missing', () => {
      expect(() => TownSocket.clearTownRoom('')).not.toThrow();
    });

    it('should leave room for all related sockets and call clientAction', () => {
      const room = 'town.1';
      const leave = jest.fn();
      const action = jest.fn();
      sockets.test1 = { leave };
      sockets.test2 = { leave };
      rooms[room] = { sockets: { test1: null, test2: null } };

      TownSocket.clearTownRoom(room, action);
      expect(action).toHaveBeenCalledTimes(Object.keys(sockets).length);
      expect(leave).toHaveBeenCalledTimes(Object.keys(sockets).length);
    });
  });

  describe('playersToTownRoom', () => {
    it('should exit cleanly if room missing', () => {
      expect(() => TownSocket.playersToTownRoom(1, '')).not.toThrow();
    });

    it('should join room for all related sockets and call clientAction', () => {
      const playerId = 12;
      const room = `player.${playerId}`;
      const townRoom = 'town.2';
      const join = jest.fn();
      const action = jest.fn();
      sockets.test1 = { join };
      sockets.test2 = { join };
      rooms[room] = { sockets: { test1: null, test2: null } };

      TownSocket.playersToTownRoom(playerId, townRoom, action);
      expect(action).toHaveBeenCalledTimes(Object.keys(sockets).length);
      expect(join).toHaveBeenCalledTimes(Object.keys(sockets).length);
    });
  });
});

describe('cancelSupport', () => {
  const units = {
    sword: 4,
    archer: 2,
    horse: 12,
  };
  const support = {
    id: 12,
    units,
    originTownId: 1,
    originTown: {
      id: 1,
      name: 'origin town',
      location: [1, 1],
    },
    targetTownId: 2,
    targetTown: {
      id: 2,
      name: 'target town',
      location: [2, 2],
    },
  };
  let getSupportSpy;
  let cancelSupportSpy;
  const rollbackSpy = jest.fn();
  const commitSpy = jest.fn();
  beforeEach(() => {
    getSupportSpy = jest.spyOn(townQueries, 'getTownSupport');
    cancelSupportSpy = jest.spyOn(townQueries, 'cancelSupport');
    socket.userData = {
      townIds: [support.originTown.id, support.targetTown.id],
    };
    rollbackSpy.mockClear();
    jest.spyOn(transaction, 'start').mockImplementationOnce(() => ({ rollback: rollbackSpy, commit: commitSpy }));
  });

  it('should rollback transaction and call socket error handler', async () => {
    const type = 'origin';
    const payload = { town: 1 };
    const error = 'dead';
    getSupportSpy.mockImplementationOnce(() => { throw error; });

    await TownSocket.cancelSupport(socket, payload, type);
    expect(rollbackSpy).toHaveBeenCalled();
    expect(socket.handleError).toHaveBeenCalledWith(error, 'support', `town:recallSupportFail`, payload);
  });

  it('should throw on missing support', async () => {
    getSupportSpy.mockImplementationOnce(() => Promise.resolve(null));

    const payload = { support: support.id + 1 };
    await TownSocket.cancelSupport(socket, payload, 'origin');
    expect(socket.handleError).toHaveBeenCalledWith(new ErrorMessage('Invalid support item'), 'support', `town:recallSupportFail`, payload);
  });

  it('should throw on missing socket town', async () => {
    getSupportSpy.mockImplementationOnce(() => Promise.resolve({}));
    socket.userData.townIds = [];
    const payload = { support: support.id };
    await TownSocket.cancelSupport(socket, payload, 'origin');
    expect(socket.handleError).toHaveBeenCalledWith(new ErrorMessage('Invalid support item'), 'support', `town:recallSupportFail`, payload);
  });

  it('should handle origin canceling support', async () => {
    const movement = {
      originTown: { id: support.targetTown.id, name: support.targetTown.name, location: support.targetTown.location } as Partial<Town>,
      targetTown: { id: support.originTown.id, name: support.originTown.name, location: support.originTown.location } as Partial<Town>,
    };
    const queueSpy = jest.spyOn(townQueue, 'addToQueue').mockImplementationOnce(() => null);
    jest.spyOn(Town, 'calculateDistance').mockImplementationOnce(() => 1);
    getSupportSpy.mockImplementationOnce(() => Promise.resolve(support));
    cancelSupportSpy.mockImplementationOnce(() => Promise.resolve(movement));
    const payload = support.id;
    await TownSocket.cancelSupport(socket, { town: support.targetTown.id, support: payload }, 'origin');

    expect(socket.handleError).not.toHaveBeenCalled();
    expect(queueSpy).toHaveBeenCalled();
    expect(emitSpy).toHaveBeenCalledTimes(2);
    expect(emitSpy).toHaveBeenCalledTimes(2);
    expect(emitSpy.mock.calls[0]).toEqual([support.originTown.id, { support: payload, movement, town: support.targetTown.id }, 'town:recallSupportSuccess']);
    expect(emitSpy.mock.calls[1]).toEqual([support.targetTown.id, { support: payload, town: support.targetTown.id }, 'town:supportRecalled']);
  });

  it('should handle target canceling support', async () => {
    const movement = {
      originTown: { id: support.targetTown.id, name: support.targetTown.name, location: support.targetTown.location } as Partial<Town>,
      targetTown: { id: support.originTown.id, name: support.originTown.name, location: support.originTown.location } as Partial<Town>,
    };
    const queueSpy = jest.spyOn(townQueue, 'addToQueue').mockImplementationOnce(() => null);
    jest.spyOn(Town, 'calculateDistance').mockImplementationOnce(() => 1);
    getSupportSpy.mockImplementationOnce(() => Promise.resolve(support));
    cancelSupportSpy.mockImplementationOnce(() => Promise.resolve(movement));
    const payload = { town: support.targetTown.id, support: support.id};
    await TownSocket.cancelSupport(socket, payload, 'target');

    expect(socket.handleError).not.toHaveBeenCalled();
    expect(queueSpy).toHaveBeenCalled();
    expect(emitSpy).toHaveBeenCalledTimes(2);
    expect(emitSpy.mock.calls[0]).toEqual([support.targetTown.id, payload, 'town:sendBackSupportSuccess']);
    expect(emitSpy.mock.calls[1]).toEqual([support.originTown.id, { support: payload.support, movement }, 'town:supportSentBack']);
  });
});

describe('notifyInvolvedCombatChanges', () => {
  beforeEach(() => {
    emitSpy = jest.spyOn(TownSocket, 'emitToTownRoom').mockImplementation(() => null);
  });

  it('should call notify for all removed data', () => {
    const notifications: InvolvedTownChanges = {
      removed: {
        originMovements: { ids: [1], townIds: [101] },
        targetSupport: { ids: [2, 3, 4], townIds: [102, 103, 104] },
        originSupport: { ids: [5, 6], townIds: [105, 106] },
      },
      updated: {},
    };
    TownSocket.notifyInvolvedCombatChanges(notifications);

    const totalCalls = notifications.removed.originMovements.ids.length +
      notifications.removed.targetSupport.ids.length +
      notifications.removed.originSupport.ids.length;

    expect(emitSpy).toHaveBeenCalledTimes(totalCalls);
    notifications.removed.originMovements.ids.forEach((id, i) => {
      const townId = notifications.removed.originMovements.townIds[i];
      expect(emitSpy).toHaveBeenCalledWith(townId, { id, townId }, 'town:movementDisbanded');
    });
    notifications.removed.targetSupport.ids.forEach((id, i) => {
      const townId = notifications.removed.targetSupport.townIds[i];
      expect(emitSpy).toHaveBeenCalledWith(townId, { id, townId }, 'town:sentSupportDestroyed');
    });
    notifications.removed.originSupport.ids.forEach((id, i) => {
      const townId = notifications.removed.originSupport.townIds[i];
      expect(emitSpy).toHaveBeenCalledWith(townId, { id, townId }, 'town:supportDisbanded');
    });
  });

  it('should call notify for all updated data', () => {
    const notifications: InvolvedTownChanges = {
      removed: {},
      updated: {
        targetSupport: {
          ids: [1, 2],
          townIds: [101, 102],
          changes: [{ units: { axe: 10 } }, { test: true }],
        },
      },
    };
    TownSocket.notifyInvolvedCombatChanges(notifications);

    const totalCalls = notifications.updated.targetSupport.ids.length;

    expect(emitSpy).toHaveBeenCalledTimes(totalCalls);
    notifications.updated.targetSupport.ids.forEach((id, i) => {
      const townId = notifications.updated.targetSupport.townIds[i];
      const changes = notifications.updated.targetSupport.changes[i];
      expect(emitSpy).toHaveBeenCalledWith(townId, { id, townId, changes }, 'town:sentSupportUpdated');
    });
  });
});
