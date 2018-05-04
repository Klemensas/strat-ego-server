import { transaction } from 'objection';

import { TownSocket } from './townSocket';
import { TownSupport } from './townSupport';
import { Town } from './town';
import { World } from '../world/world';
import { worldData } from '../world/worldData';
import { UserSocket, ErrorMessage } from '../../config/socket';
import { townQueue } from '../townQueue';
import { Movement } from './movement';
import * as townQueries from './townQueries';

beforeAll(() => {
  worldData.unitMap = {
    sword: { speed: 1 },
    archer: { speed: 2 },
    horse: { speed: 2 },
  } as any;
  worldData.world = {
    baseProduction: 500,
  } as World;
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
  let socket: UserSocket;
  const getSupportSpy = jest.spyOn(townQueries, 'getTownSupport');
  const deleteSupportSpy = jest.spyOn(townQueries, 'deleteSupport');
  let emitSpy;
  beforeEach(() => {
    socket = {
      handleError: jest.fn().mockImplementationOnce(() => null),
      userData: {
        townIds: [support.originTown.id, support.targetTown.id],
      },
    } as any;
    emitSpy = jest.spyOn(TownSocket, 'emitToTownRoom').mockImplementationOnce(() => null);
    emitSpy.mockReset();
  });

  test('should rollback transaction and call socket handler', async () => {
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

  test('should throw on missing support', async () => {
    getSupportSpy.mockImplementationOnce(() => Promise.resolve(null));

    await TownSocket.cancelSupport(socket, support.id + 1, 'origin');
    expect(socket.handleError).toHaveBeenCalledWith(new ErrorMessage('Invalid support item'), 'support', `town:recallSupportFail`, support.id + 1);
  });

  test('should throw on missing socket town', async () => {
    getSupportSpy.mockImplementationOnce(() => Promise.resolve({}));
    socket.userData.townIds = [];
    await TownSocket.cancelSupport(socket, support.id, 'origin');
    expect(socket.handleError).toHaveBeenCalledWith(new ErrorMessage('Invalid support item'), 'support', `town:recallSupportFail`, support.id);
  });

  test('should handle origin canceling support', async () => {
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

  test('should handle target canceling support', async () => {
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
