import { test } from 'ava';

import { knexDb } from '../../sqldb';
import { worldData } from '../world/worldData';
import { Town } from './town';
import { Building } from '../building/building';
import { World } from '../world/world';

const buildings = [{
  id: 1,
  name: 'building #1',
  levels: {
    max: 3,
    min: 1,
  },
  data: [
    { score: 1, buildTime: 1, costs: { wood: 1, clay: 1, iron: 1 } },
    { score: 2, buildTime: 2, costs: { wood: 2, clay: 2, iron: 2 } },
    { score: 3, buildTime: 3, costs: { wood: 3, clay: 3, iron: 3 } },
  ],
}, {
  id: 2,
  name: 'building #2',
  levels: {
    max: 1,
    min: 0,
  },
  data: [
    { score: 5, buildTime: 1, costs: { wood: 1, clay: 1, iron: 1 } },
  ],
}];
worldData.buildings = buildings as Building[];
worldData.world = { baseProduction: 10 } as World;

const testTownData = {
  id: 12,
  name: 'bess town',
  loyalty: 100,
  production: { wood: 10, clay: 10, iron: 10 },
  resources: { wood: 20, clay: 30, iron: 40 },
  units: {},
  buildings: buildings.reduce((result, item) => {
    result[item.name] = { level: item.levels.min, queued: 0 };
    return result;
  }, {}),
  score: 0,
};

let testTown: Town;
test.beforeEach(() => {
  testTown  = Town.fromJson(testTownData, { skipValidation: true });
});

test('calculateScore should return total town score', (t) => {
  const score = buildings.reduce((result, item) => result + item.levels.min * item.data[0].score, 0);
  t.is(testTown.calculateScore(), score);

  const maxScore = buildings.reduce((result, item) => result + item.data[item.data.length - 1].score, 0);
  testTown.buildings = buildings.reduce((result, item) => {
    result[item.name] = { level: item.levels.max, queued: 0 };
    return result;
  }, {});
  t.is(testTown.calculateScore(), maxScore);
});
