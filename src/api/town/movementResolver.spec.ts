import { transaction } from 'objection';
import { Dict, MovementType } from 'strat-ego-common';

import { MovementResolver } from './movementResolver';
import { worldData } from '../world/worldData';
import { TownSupport } from './townSupport';
import { Town } from './town';
import { townQueue } from '../townQueue';
import { World } from '../world/world';
import { TownSocket } from './townSocket';
import * as townQueries from './townQueries';

beforeAll(() => {
  worldData.unitMap = {
    archer: { combat: { defense: { general: 1, cavalry: 20, archer: 300 }, attack: 1 }, attackType: 'archer' },
    sword: { combat: { defense: { general: 4000, cavalry: 50000, archer: 600000 }, attack: 20 }, attackType: 'general' },
    horse: { combat: { defense: { general: 7000000, cavalry: 80000000, archer: 900000000 }, attack: 300 }, attackType: 'cavalry' },
  } as any;
  worldData.world = {
    baseProduction: 500,
  } as World;
});

it('calculateSurvivalPercent should return a percent multiplier number', () => {
  const cases = [
    [[100, 10], 0.9683772233983162],
    [[10, 20], -1.8284271247461903],
    [[1, 1], 0],
  ];
  cases.forEach(([item, expected]) => expect(MovementResolver.calculateSurvivalPercent(item[0], item[1])).toBe(expected));
});

it('updateMissingTown should process queues and remove processed', async () => {
  const processed = [{ id: 1 }, { id: 2}];
  const town = { id: 1, name: 'test town' };
  const testId = 12;
  const testDate = 4567;
  const processSpy = jest.spyOn(Town, 'processTownQueues').mockImplementationOnce(() => Promise.resolve({ town, processed }));
  const queueSpy = jest.spyOn(townQueue, 'removeFromQueue');

  const result = await MovementResolver.updateMissingTown(testId, testDate);
  expect(result).toEqual(town);
  expect(townQueue.removeFromQueue).toHaveBeenCalledWith(...processed);
  expect(Town.processTownQueues).toHaveBeenCalledWith(testId, testDate);
});

describe('resolveSupport', () => {
  const units = {
    archer: 3,
    sword: 4,
  };
  let support;
  let movement;
  let socketSpy: jest.Mock;
  const rollbackSpy = jest.fn();
  const commitSpy = jest.fn();

  beforeEach(() => {
    jest.spyOn(transaction, 'start').mockImplementationOnce(() => ({ rollback: rollbackSpy, commit: commitSpy }));
    movement = {
      id: 13,
      type: MovementType.support,
      units,
      originTownId: 1,
      originTown: {
        id: 1,
        originMovements: [{ id: 13 }],
        targetMovements: [],
        location: [1, 1],
      },
      targetTownId: 2,
      targetTown: {
        id: 2,
        originMovements: [],
        targetMovements: [{ id: 13 }],
        location: [2, 2],
      },
      haul: null,
      endsAt: Date.now(),
    } as any;
    support = TownSupport.fromJson({
      id: 453,
      originTownId: movement.originTownId,
      targetTownId: movement.targetTownId,
      units,
    });
    jest.spyOn(townQueries, 'deleteMovementItem').mockImplementationOnce(() => Promise.resolve());
    jest.spyOn(townQueries, 'createSupport').mockImplementationOnce(() => Promise.resolve(support));
    socketSpy = jest.spyOn(TownSocket, 'emitToTownRoom').mockImplementation(() => null);
  });

  it('should rollback transaction and rethrow error', async () => {
    const error = 'test';
    jest.spyOn(MovementResolver, 'updateMissingTown').mockImplementationOnce(() => { throw error; });

    let thrownError;
    try {
      await MovementResolver.resolveSupport(movement, movement.originTown);
    } catch (err) {
      thrownError = err;
    }
    expect(MovementResolver.updateMissingTown).toHaveBeenCalledWith(movement.targetTownId, +movement.endsAt - 1);
    expect(transaction.start).toHaveBeenCalled();
    expect(thrownError).toEqual(error);
    expect(rollbackSpy).toHaveBeenCalled();
  });

  it('should correctly resolve support for origin towns', async () => {
    const target = movement.originTown;
    const missingTown = movement.targetTown;
    delete movement.targetTown;

    const processSpy = jest.spyOn(MovementResolver, 'updateMissingTown').mockImplementationOnce(() => Promise.resolve({
      ...missingTown,
      targetSupport: [],
      originSupport: [],
    }));

    const resultTown = await MovementResolver.resolveSupport(movement, { ...target, originSupport: [] });
    expect(resultTown.originSupport).toHaveLength(1);
    expect(resultTown.originSupport[0] instanceof TownSupport).toBeTruthy();
    expect(resultTown).toEqual({
      ...target,
      originMovements: [],
      originSupport: resultTown.originSupport,
    });

    const prevCall = socketSpy.mock.calls[socketSpy.mock.calls.length - 2];
    const lastCall = socketSpy.mock.calls[socketSpy.mock.calls.length - 1];
    expect(prevCall).toEqual([
      target.id,
      {
        town: target.id,
        movement: movement.id,
        support,
      },
      'town:supportArrived',
    ]);
    expect(lastCall).toEqual([
      missingTown.id,
      {
        town: missingTown.id,
        movement: movement.id,
        support,
      },
      'town:supportStationed',
    ]);
  });

  it('should correctly resolve support for target towns', async () => {
    const target = movement.targetTown;
    const missingTown = movement.originTown;
    delete movement.originTown;

    const processSpy = jest.spyOn(MovementResolver, 'updateMissingTown').mockImplementationOnce(() => Promise.resolve({
      ...missingTown,
      targetSupport: [],
      originSupport: [],
    }));

    const resultTown = await MovementResolver.resolveSupport(movement, { ...target, targetSupport: [] });
    expect(resultTown.targetSupport).toHaveLength(1);
    expect(resultTown.targetSupport[0] instanceof TownSupport).toBeTruthy();
    expect(resultTown).toEqual({
      ...target,
      targetMovements: [],
      targetSupport: resultTown.targetSupport,
    });

    const prevCall = socketSpy.mock.calls[socketSpy.mock.calls.length - 2];
    const lastCall = socketSpy.mock.calls[socketSpy.mock.calls.length - 1];
    expect(prevCall).toEqual([
      missingTown.id,
      {
        town: missingTown.id,
        movement: movement.id,
        support,
      },
      'town:supportArrived',
    ]);
    expect(lastCall).toEqual([
      target.id,
      {
        town: target.id,
        movement: movement.id,
        support,
      },
      'town:supportStationed',
    ]);
  });

});

describe('combat strength', () => {
  const cases: Array<Array<Dict<number>>> = [
    [],
    [{ sword: 3, horse: 1 }],
    [
      { archer: 2, horse: 0, sword: 1 },
      { horse: 2, archer: 6 },
    ],
  ];
  const expected = [
    { general: 0, cavalry: 0, archer: 0 },
    { general: 4000 * 3 + 7000000, cavalry: 50000 * 3 + 80000000, archer: 600000 * 3 + 900000000 },
    { general: 1 * 8 + 4000 * 1 + 7000000 * 2, cavalry: 20 * 8 + 50000 * 1 + 80000000 * 2, archer: 300 * 8 + 600000 * 1 + 900000000 * 2 },
  ];
  const expectedAttack = [
    { general: 0, cavalry: 0, archer: 0 },
    { general: 60, cavalry: 300, archer: 0 },
    { general: 20, cavalry: 600, archer: 8 },
  ];

  it('calculateSupportStrength', () => {
    cases.forEach((item, i) => expect(MovementResolver.calculateSupportStrength(item.map((units) => ({ units })))).toEqual(expected[i]));
  });

  it('calculateDefenseStrength', () => {
    cases.forEach((item, i) => {
      const unitList = item
        .reduce((result, units) => {
          Object.entries(units).forEach(([key, val]) => result[key] = (result[key] || 0) + val);
          return result;
        }, {} as any);
      const test = Object.entries(unitList).reduce((result, [key, val]) => ([ ...result, [key, { inside: val }]]), []);
      expect(MovementResolver.calculateDefenseStrength(test)).toEqual(expected[i]);
    });
  });

  it('calculateAttackStrength', () => {
    cases.forEach((item, i) => {
      const unitList = item
        .reduce((result, units) => {
          Object.entries(units).forEach(([key, val]) => result[key] = (result[key] || 0) + val);
          return result;
        }, {} as any);
      const test = Object.entries(unitList).reduce((result, [key, val]) => ([ ...result, [key, val]]), []);
      expect(MovementResolver.calculateAttackStrength(test)).toEqual(expectedAttack[i]);
    });
  });
});
