import { MovementResolver } from './movement.resolver';
import { worldData } from '../world/worldData';
import { TownSupport } from './townSupport';
import { Combat, CombatStrength, Dict, TownUnit } from 'strat-ego-common';

test('calculateSurvivalPercent should return a percent multiplier number', () => {
  const cases = [
    [[100, 10], 0.9683772233983162],
    [[10, 20], -1.8284271247461903],
    [[1, 1], 0],
  ];
  cases.forEach(([item, expected]) => expect(MovementResolver.calculateSurvivalPercent(item[0], item[1])).toBe(expected));
});

describe('combat strength', () => {
  worldData.unitMap = {
    archer: { combat: { defense: { general: 1, cavalry: 20, archer: 300 }, attack: 1 }, attackType: 'archer' },
    sword: { combat: { defense: { general: 4000, cavalry: 50000, archer: 600000 }, attack: 20 }, attackType: 'general' },
    horse: { combat: { defense: { general: 7000000, cavalry: 80000000, archer: 900000000 }, attack: 300 }, attackType: 'cavalry' },
  } as any;

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
