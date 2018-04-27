import { transaction } from 'objection';

import { TownSocket } from './town.socket';
import { TownSupport } from './townSupport';
import { knexDb } from '../../sqldb';
import { Town } from './town';
import { World } from '../world/world';
import { worldData } from '../world/worldData';
import { UserSocket, ErrorMessage } from '../../config/socket';
import { townQueue } from '../townQueue';
import { Movement } from './movement';

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
  let support: TownSupport;
  let socket: UserSocket;
  let emitSpy;
  beforeEach(async () => {
    support = await TownSupport.query(knexDb.world).insertGraph({
      units,
      originTown: {
        name: 'origin town',
        location: [1, 1],
      },
      targetTown: {
        name: 'target town',
        location: [2, 2],
      },
    });
    socket = {
      handleError: jest.fn().mockImplementation(() => null),
      userData: {
        townIds: [support.originTown.id, support.targetTown.id],
      },
    } as any;
    emitSpy = jest.spyOn(TownSocket, 'emitToTownRoom').mockImplementation(() => null);
    emitSpy.mockReset();
    return;
  });

  afterEach(async () => {
    return await Town.query(knexDb.world).del();
  });

  test('should rollback transaction and call socket handler', async () => {
    const type = 'origin';
    const payload = 1;
    const transactionSpy = jest.fn();
    const error = 'dead';
    jest.spyOn(transaction, 'start').mockImplementationOnce(() => ({ rollback: transactionSpy }));
    jest.spyOn(TownSupport, 'query').mockImplementationOnce(() => { throw error; });

    await TownSocket.cancelSupport(socket, payload, type);
    expect(transactionSpy).toHaveBeenCalled();
    expect(socket.handleError).toHaveBeenCalledWith(error, 'support', `town:recallSupportFail`, payload);
  });

  test('should throw on missing support', async () => {
    await TownSocket.cancelSupport(socket, support.id + 1, 'origin');
    expect(socket.handleError).toHaveBeenCalledWith(new ErrorMessage('Invalid support item'), 'support', `town:recallSupportFail`, support.id + 1);
  });

  test('should throw on missing socket town', async () => {
    socket.userData.townIds = [];
    await TownSocket.cancelSupport(socket, support.id, 'origin');
    expect(socket.handleError).toHaveBeenCalledWith(new ErrorMessage('Invalid support item'), 'support', `town:recallSupportFail`, support.id);
  });

  test('should handle origin canceling support', async () => {
    const queueSpy = jest.spyOn(townQueue, 'addToQueue').mockImplementationOnce(() => null);
    jest.spyOn(Town, 'calculateDistance').mockImplementationOnce(() => 1);
    const payload = support.id;
    await TownSocket.cancelSupport(socket, payload, 'origin');

    // Fetch and populate movement data to match emit data
    const movement = await Movement.query(knexDb.world).findOne({ targetTownId: support.originTown.id });
    movement.originTown = { id: support.targetTown.id, name: support.targetTown.name, location: support.targetTown.location };
    movement.targetTown = { id: support.originTown.id, name: support.originTown.name, location: support.originTown.location };
    movement.endsAt = +movement.endsAt;
    movement.createdAt = +movement.createdAt;
    movement.updatedAt = +movement.updatedAt;

    expect(socket.handleError).not.toHaveBeenCalled();
    expect(queueSpy).toHaveBeenCalled();
    expect(emitSpy).toHaveBeenCalledTimes(2);
    expect(emitSpy).toHaveBeenCalledTimes(2);
    expect(emitSpy.mock.calls[0]).toEqual([support.originTown.id, { support: payload, movement}, 'town:recallSupportSuccess']);
    expect(emitSpy.mock.calls[1]).toEqual([support.targetTown.id, { support: payload, town: support.targetTown.id }, 'town:supportRecalled']);
  });

  test('should handle target canceling support', async () => {
    const queueSpy = jest.spyOn(townQueue, 'addToQueue').mockImplementationOnce(() => null);
    jest.spyOn(Town, 'calculateDistance').mockImplementationOnce(() => 1);
    const payload = support.id;
    await TownSocket.cancelSupport(socket, payload, 'target');

    // Fetch and populate movement data to match emit data
    const movement = await Movement.query(knexDb.world).findOne({ targetTownId: support.originTown.id });
    movement.originTown = { id: support.targetTown.id, name: support.targetTown.name, location: support.targetTown.location };
    movement.targetTown = { id: support.originTown.id, name: support.originTown.name, location: support.originTown.location };
    movement.endsAt = +movement.endsAt;
    movement.createdAt = +movement.createdAt;
    movement.updatedAt = +movement.updatedAt;

    expect(socket.handleError).not.toHaveBeenCalled();
    expect(queueSpy).toHaveBeenCalled();
    expect(emitSpy).toHaveBeenCalledTimes(2);
    expect(emitSpy).toHaveBeenCalledTimes(2);
    expect(emitSpy.mock.calls[0]).toEqual([support.targetTown.id, payload, 'town:sendBackSupportSuccess']);
    expect(emitSpy.mock.calls[1]).toEqual([support.originTown.id, { support: payload, movement }, 'town:supportSentBack']);
  });
});
