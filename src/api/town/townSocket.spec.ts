import { transaction } from 'objection';
import { EventEmitter } from 'events';

import { TownSocket } from './townSocket';
import { Town } from './town';
import { World } from '../world/world';
import { worldData } from '../world/worldData';
import { UserSocket, ErrorMessage } from '../../config/socket';
import { townQueue } from '../townQueue';
import * as townQueries from './townQueries';
import { NamePayload, BuildPayload, RecruitPayload, TroopMovementPayload, MovementType } from 'strat-ego-common';

let socket: UserSocket;
let emitSpy;
beforeEach(() => {
  socket = new EventEmitter() as UserSocket;
  socket.handleError = jest.fn().mockImplementation(() => null);
  socket.join = jest.fn().mockImplementation(() => null);
  socket.userData = {};
  emitSpy = jest.spyOn(TownSocket, 'emitToTownRoom').mockImplementationOnce(() => null);
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
  const socketEvents = [
    'town:rename',
    'town:build',
    'town:recruit',
    'town:moveTroops',
    'town:recallSupport',
    'town:sendBackSupport',
  ];

  it('should register events', () => {
    jest.spyOn(TownSocket, 'joinTownRoom').mockImplementationOnce(() => null);
    expect(socket.eventNames()).toHaveLength(0);
    TownSocket.onConnect(socket);
    expect(TownSocket.joinTownRoom).toHaveBeenCalledWith(socket);
    expect(socket.eventNames()).toEqual(socketEvents);
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
  let deleteSupportSpy;
  beforeEach(() => {
    getSupportSpy = jest.spyOn(townQueries, 'getTownSupport');
    deleteSupportSpy = jest.spyOn(townQueries, 'deleteSupport');
    socket.userData = {
      townIds: [support.originTown.id, support.targetTown.id],
    };
  });

  it('should rollback transaction and call socket error handler', async () => {
    const type = 'origin';
    const payload = 1;
    const transactionSpy = jest.fn();
    const error = 'dead';
    jest.spyOn(transaction, 'start').mockImplementationOnce(() => ({ rollback: transactionSpy }));
    getSupportSpy.mockImplementationOnce(() => { throw error; });

    await TownSocket.cancelSupport(socket, payload, type);
    expect(transactionSpy).toHaveBeenCalled();
    expect(socket.handleError).toHaveBeenCalledWith(error, 'support', `town:recallSupportFail`, payload);
  });

  it('should throw on missing support', async () => {
    getSupportSpy.mockImplementationOnce(() => Promise.resolve(null));

    await TownSocket.cancelSupport(socket, support.id + 1, 'origin');
    expect(socket.handleError).toHaveBeenCalledWith(new ErrorMessage('Invalid support item'), 'support', `town:recallSupportFail`, support.id + 1);
  });

  it('should throw on missing socket town', async () => {
    getSupportSpy.mockImplementationOnce(() => Promise.resolve({}));
    socket.userData.townIds = [];
    await TownSocket.cancelSupport(socket, support.id, 'origin');
    expect(socket.handleError).toHaveBeenCalledWith(new ErrorMessage('Invalid support item'), 'support', `town:recallSupportFail`, support.id);
  });

  it('should handle origin canceling support', async () => {
    const movement = {
      originTown: { id: support.targetTown.id, name: support.targetTown.name, location: support.targetTown.location } as Partial<Town>,
      targetTown: { id: support.originTown.id, name: support.originTown.name, location: support.originTown.location } as Partial<Town>,
    };
    const queueSpy = jest.spyOn(townQueue, 'addToQueue').mockImplementationOnce(() => null);
    jest.spyOn(Town, 'calculateDistance').mockImplementationOnce(() => 1);
    getSupportSpy.mockImplementationOnce(() => Promise.resolve(support));
    deleteSupportSpy.mockImplementationOnce(() => Promise.resolve(movement));
    const payload = support.id;
    await TownSocket.cancelSupport(socket, payload, 'origin');

    expect(socket.handleError).not.toHaveBeenCalled();
    expect(queueSpy).toHaveBeenCalled();
    expect(emitSpy).toHaveBeenCalledTimes(2);
    expect(emitSpy).toHaveBeenCalledTimes(2);
    expect(emitSpy.mock.calls[0]).toEqual([support.originTown.id, { support: payload, movement}, 'town:recallSupportSuccess']);
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
    deleteSupportSpy.mockImplementationOnce(() => Promise.resolve(movement));
    const payload = support.id;
    await TownSocket.cancelSupport(socket, payload, 'target');

    expect(socket.handleError).not.toHaveBeenCalled();
    expect(queueSpy).toHaveBeenCalled();
    expect(emitSpy).toHaveBeenCalledTimes(2);
    expect(emitSpy).toHaveBeenCalledTimes(2);
    expect(emitSpy.mock.calls[0]).toEqual([support.targetTown.id, payload, 'town:sendBackSupportSuccess']);
    expect(emitSpy.mock.calls[1]).toEqual([support.originTown.id, { support: payload, movement }, 'town:supportSentBack']);
  });
});
