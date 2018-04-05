import { test } from 'ava';

import { MovementResolver } from './movement.resolver';

test('calculateSurvivalPercent should return a percent multiplier number', (t) => {
  const cases = [
    [[100, 10], 0.9683772233983162],
    [[10, 20], -1.8284271247461903],
    [[1, 1], 0],
  ];
  cases.forEach((item) => {
    t.is(MovementResolver.calculateSurvivalPercent(item[0][0], item[0][1]), item[1]);
  });
});
