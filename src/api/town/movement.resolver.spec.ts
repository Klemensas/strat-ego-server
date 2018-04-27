import { Combat, CombatStrength, Dict, TownUnit, MovementType } from 'strat-ego-common';
import { transaction } from 'objection';

import { MovementResolver } from './movement.resolver';
import { worldData } from '../world/worldData';
import { TownSupport } from './townSupport';
import { Town } from './town';
import { townQueue } from '../townQueue';
import { Movement } from './movement';
import { knexDb } from '../../sqldb';
import { World } from '../world/world';
import { TownSocket } from './town.socket';

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

test('calculateSurvivalPercent should return a percent multiplier number', () => {
  const cases = [
    [[100, 10], 0.9683772233983162],
    [[10, 20], -1.8284271247461903],
    [[1, 1], 0],
  ];
  cases.forEach(([item, expected]) => expect(MovementResolver.calculateSurvivalPercent(item[0], item[1])).toBe(expected));
});

test('updateMissingTown should process queues and remove processed', async () => {
  const processed = ['mock', 2];
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
  let movement;
  beforeEach(async (done) => {
    movement = await Movement.query(knexDb.world).insertGraph({
      type: MovementType.support,
      units: {
        archer: 3,
        sword: 4,
      },
      originTown: {
        location: [1, 1],
      },
      targetTown: {
        location: [2, 2],
      },
      endsAt: Date.now(),
    });
    movement.originTown.originMovements = [{ id: movement.id }];
    movement.targetTown.targetMovements = [{ id: movement.id }];
    done();
  });
  afterEach(async (done) => {
    await Town.query(knexDb.world).del();
    done();
  });

  test('should rollback transaction and rethrow error', async () => {
    const error = 'test';
    const transactionSpy = jest.fn();
    jest.spyOn(transaction, 'start').mockImplementationOnce(() => ({ rollback: transactionSpy }));
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
    expect(transactionSpy).toHaveBeenCalled();
  });

  test('should correctly resolve support for origin towns', async () => {
    const target = movement.originTown;
    const missingTown = movement.targetTown;
    delete movement.targetTown;

    const processSpy = jest.spyOn(MovementResolver, 'updateMissingTown').mockImplementationOnce(() => Promise.resolve({
      ...missingTown,
      targetSupport: [],
      originSupport: [],
    }));
    const socketSpy = jest.spyOn(TownSocket, 'emitToTownRoom').mockImplementationOnce(() => null);

    const resultTown = await MovementResolver.resolveSupport(movement, { ...target, originSupport: [] });
    const movements = await Movement.query(knexDb.world).select();
    expect(resultTown.originSupport).toHaveLength(1);
    expect(resultTown.originSupport[0] instanceof TownSupport).toBeTruthy();
    expect(resultTown).toEqual({
      ...target,
      originMovements: [],
      originSupport: resultTown.originSupport,
    });
    expect(TownSocket.emitToTownRoom).toHaveBeenCalledWith(missingTown.id, {
      ...missingTown,
      targetMovements: [],
      targetSupport: resultTown.originSupport,
    }, 'town:update');
    expect(movements).toHaveLength(0);
  });

  test('should correctly resolve support for target towns', async () => {
    const target = movement.targetTown;
    const missingTown = movement.originTown;
    delete movement.originTown;

    const processSpy = jest.spyOn(MovementResolver, 'updateMissingTown').mockImplementationOnce(() => Promise.resolve({
      ...missingTown,
      targetSupport: [],
      originSupport: [],
    }));
    const socketSpy = jest.spyOn(TownSocket, 'emitToTownRoom').mockImplementationOnce(() => null);

    const resultTown = await MovementResolver.resolveSupport(movement, { ...target, targetSupport: [] });
    const movements = await Movement.query(knexDb.world).select();
    expect(resultTown.targetSupport).toHaveLength(1);
    expect(resultTown.targetSupport[0] instanceof TownSupport).toBeTruthy();
    expect(resultTown).toEqual({
      ...target,
      targetMovements: [],
      targetSupport: resultTown.targetSupport,
    });
    expect(TownSocket.emitToTownRoom).toHaveBeenCalledWith(missingTown.id, {
      ...missingTown,
      originMovements: [],
      originSupport: resultTown.targetSupport,
    }, 'town:update');
    expect(movements).toHaveLength(0);
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

  test('calculateSupportStrength', () => {
    cases.forEach((item, i) => expect(MovementResolver.calculateSupportStrength(item.map((units) => ({ units })))).toEqual(expected[i]));
  });

  test('calculateDefenseStrength', () => {
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

  test('calculateAttackStrength', () => {
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
