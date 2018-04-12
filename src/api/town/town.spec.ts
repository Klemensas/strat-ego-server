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
  updatedAt: Date.now(),
  createdAt: Date.now(),
};

let testTown: Town;
let calculateScoreSpy;
beforeAll(() => {
  calculateScoreSpy = jest.spyOn(Town, 'calculateScore');
});
afterAll(() => {
  calculateScoreSpy.mockRestore();
});
beforeEach(() => {
  testTown  = Town.fromJson(testTownData, { skipValidation: true });
});

// test.only('dumb', async () => {
//   await Town.query(knexDb.world).delete();
//   const town = await Town
//     .query(knexDb.world)
//     .insert({ name: 'test', location: [401, 402] })
//     .pick(['name', 'id']);
//   const spy = jest.spyOn(town, '$beforeUpdate');

//   await town
//     .$query(knexDb.world)
//     .patch({
//       name: 'test',
//     })
//     .context({
//       resourcesUpdated: true,
//       loyaltyUpdated: true,
//     });
//   // const spyResult = 
//   console.log('spy', spy.mock.calls)
//   expect(spy).toBe(null);
// })

describe('$beforeUpdate', () => {
  let getResourcesSpy;
  let getLoyaltySpy;
  const patchData = {
    updatedAt: Date.now() + 500000,
  };

  beforeEach(() => {
    getResourcesSpy = jest.spyOn(testTown, 'getResources').mockImplementation(() => ({}));
    getLoyaltySpy = jest.spyOn(testTown, 'getLoyalty').mockImplementation(() => ({}));
  });

  test('should only work if old value is available and set date as needed', () => {
    testTown.$beforeUpdate({}, {});
    expect(testTown.updatedAt).toBe(testTownData.updatedAt);

    // Remove updatedAt to simulate patch as patch only has the updated properties
    delete testTown.updatedAt;
    testTown.$beforeUpdate({ old: patchData }, {});
    expect(testTown.updatedAt).toBeTruthy();
    expect(testTown.updatedAt).not.toBe(testTownData.updatedAt);
  });

  test('should update resources only on no resourcesUpdated flag', () => {
    testTown.$beforeUpdate({ old: patchData }, { resourcesUpdated: true });
    expect(getResourcesSpy).not.toHaveBeenCalled();
    expect(testTown.resources).toBe(testTownData.resources);

    testTown.$beforeUpdate({ old: patchData }, {});
    expect(getResourcesSpy).toHaveBeenCalledWith(testTownData.updatedAt, patchData.updatedAt, patchData);
    expect(testTown.resources).not.toBe(testTownData.resources);
  });

  test('should update loyalty only on no loyaltyUpdated flag', () => {
    testTown.$beforeUpdate({ old: patchData }, { loyaltyUpdated: true });
    expect(getLoyaltySpy).not.toHaveBeenCalled();
    expect(testTown.loyalty).toBe(testTownData.loyalty);

    testTown.$beforeUpdate({ old: patchData }, {});
    expect(getLoyaltySpy).toHaveBeenCalledWith(testTownData.updatedAt, patchData.updatedAt, patchData);
    expect(testTown.loyalty).not.toBe(testTownData.loyalty);
  });

  test('should update score only if updateScore flag is present', () => {
    testTown.$beforeUpdate({ old: patchData }, {});
    expect(calculateScoreSpy).not.toHaveBeenCalled();
    expect(testTown.score).toBe(testTownData.score);

    testTown.$beforeUpdate({ old: patchData }, { updateScore: true });
    expect(calculateScoreSpy).toHaveBeenCalledWith(testTown.buildings);
    expect(testTown.score).not.toBe(testTownData.score);
  });

  test('should work with mixed flags', () => {
    testTown.$beforeUpdate({ old: patchData }, { updateScore: true });
    expect(getResourcesSpy).toHaveBeenCalledWith(testTownData.updatedAt, patchData.updatedAt, patchData);
    expect(testTown.resources).not.toBe(testTownData.resources);
    expect(getLoyaltySpy).toHaveBeenCalledWith(testTownData.updatedAt, patchData.updatedAt, patchData);
    expect(testTown.loyalty).not.toBe(testTownData.loyalty);
    expect(calculateScoreSpy).toHaveBeenCalledWith(testTown.buildings);
    expect(testTown.score).not.toBe(testTownData.score);

  });
});

test('calculateScore should return total town score', () => {
  const score = buildings.reduce((result, item) => result + item.levels.min * item.data[0].score, 0);
  expect(Town.calculateScore(testTown.buildings)).toBe(score);

  const maxScore = buildings.reduce((result, item) => result + item.data[item.data.length - 1].score, 0);
  testTown.buildings = buildings.reduce((result, item) => {
    result[item.name] = { level: item.levels.max, queued: 0 };
    return result;
  }, {});
  expect(Town.calculateScore(testTown.buildings)).toBe(maxScore);
});
