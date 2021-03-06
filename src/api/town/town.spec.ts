import { knexDb } from '../../sqldb';
import { worldData } from '../world/worldData';
import { Town } from './town';
import { World } from '../world/world';

const buildings = [{
  id: 1,
  name: 'building #1',
  levels: {
    max: 3,
    min: 1,
  },
  data: [
    { score: 0, buildTime: 1, costs: { wood: 1, clay: 1, iron: 1 } },
    { score: 2, buildTime: 2, costs: { wood: 2, clay: 2, iron: 2 } },
    { score: 3, buildTime: 3, costs: { wood: 3, clay: 3, iron: 3 } },
    { score: 4, buildTime: 4, costs: { wood: 4, clay: 4, iron: 4 } },
  ],
}, {
  id: 2,
  name: 'farm',
  levels: {
    max: 1,
    min: 1,
  },
  data: [
    { score: 0, buildTime: 1, costs: { wood: 1, clay: 1, iron: 1 }, population: 0 },
    { score: 6, buildTime: 60, costs: { wood: 60, clay: 60, iron: 60 }, population: 100 },
  ],
}];
worldData.buildings = buildings as any;
worldData.buildingMap = buildings.reduce((result, item) => ({ ...result, [item.name]: item }), {});
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
  originSupport: [],
  targetSupport: [],
  originMovements: [],
  targetMovements: [],
  updatedAt: Date.now(),
  createdAt: Date.now(),
};

let testTown: Town;
let calculateScoreSpy;
beforeEach(() => {
  testTown  = Town.fromJson(testTownData, { skipValidation: true });
  calculateScoreSpy = jest.spyOn(Town, 'calculateScore');
});

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

  it('should only work if old value is available and set date as needed', () => {
    testTown.$beforeUpdate({}, {});
    expect(testTown.updatedAt).toBe(testTownData.updatedAt);

    // Remove updatedAt to simulate patch as patch only has the updated properties
    delete testTown.updatedAt;
    testTown.$beforeUpdate({ old: patchData }, {});
    expect(testTown.updatedAt).toBeTruthy();
    expect(testTown.updatedAt).not.toBe(testTownData.updatedAt);
  });

  it('should update resources only on no resourcesUpdated flag', () => {
    testTown.$beforeUpdate({ old: patchData }, { resourcesUpdated: true });
    expect(getResourcesSpy).not.toHaveBeenCalled();
    expect(testTown.resources).toBe(testTownData.resources);

    testTown.$beforeUpdate({ old: patchData }, {});
    expect(getResourcesSpy).toHaveBeenCalledWith(testTownData.updatedAt, patchData.updatedAt, patchData);
    expect(testTown.resources).not.toBe(testTownData.resources);
  });

  it('should update loyalty only on no loyaltyUpdated flag', () => {
    testTown.$beforeUpdate({ old: patchData }, { loyaltyUpdated: true });
    expect(getLoyaltySpy).not.toHaveBeenCalled();
    expect(testTown.loyalty).toBe(testTownData.loyalty);

    testTown.$beforeUpdate({ old: patchData }, {});
    expect(getLoyaltySpy).toHaveBeenCalledWith(testTownData.updatedAt, patchData.updatedAt, patchData);
    expect(testTown.loyalty).not.toBe(testTownData.loyalty);
  });

  it('should update score only if updateScore flag is present', () => {
    testTown.$beforeUpdate({ old: patchData }, {});
    expect(calculateScoreSpy).not.toHaveBeenCalled();
    expect(testTown.score).toBe(testTownData.score);

    testTown.$beforeUpdate({ old: patchData }, { updateScore: true });
    expect(calculateScoreSpy).toHaveBeenCalledWith(testTown.buildings);
    expect(testTown.score).not.toBe(testTownData.score);
  });

  it('should work with mixed flags', () => {
    testTown.$beforeUpdate({ old: patchData }, { updateScore: true });
    expect(getResourcesSpy).toHaveBeenCalledWith(testTownData.updatedAt, patchData.updatedAt, patchData);
    expect(testTown.resources).not.toBe(testTownData.resources);
    expect(getLoyaltySpy).toHaveBeenCalledWith(testTownData.updatedAt, patchData.updatedAt, patchData);
    expect(testTown.loyalty).not.toBe(testTownData.loyalty);
    expect(calculateScoreSpy).toHaveBeenCalledWith(testTown.buildings);
    expect(testTown.score).not.toBe(testTownData.score);

  });
});

it('calculateScore should return total town score', () => {
  const score = buildings.reduce((result, item) => result + item.levels.min * item.data[1].score, 0);
  expect(Town.calculateScore(testTown.buildings)).toBe(score);

  const maxScore = buildings.reduce((result, item) => {
    return result + item.data[item.data.length - 1].score;
  }, 0);
  testTown.buildings = buildings.reduce((result, item) => {
    result[item.name] = { level: item.levels.max, queued: 0 };
    return result;
  }, {});
  expect(Town.calculateScore(testTown.buildings)).toBe(maxScore);
});

describe('getAvailablePopulation', () => {
  it('should have full population without any items', () => {
    testTown.getAvailablePopulation();
  });
});
