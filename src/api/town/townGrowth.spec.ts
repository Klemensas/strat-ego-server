import * as lolex from 'lolex';
import { transaction } from 'objection';

import { worldData } from '../world/worldData';
import { Town } from '../town/town';
import { World } from '../world/world';
import * as townQueries from '../town/townQueries';
import { Unit } from '../unit/unit';
import { Building } from '../building/building';
import { TownGrowth } from './townGrowth';
import { Coords } from 'strat-ego-common/dist';

const world = {
  name: 'test',
  baseProduction: 10,
  loyaltyRegeneration: 1,
  barbPercent: 0.5,
} as World;
const units = [{ id: 1, name: 'sworder' }] as Unit[];
const unitMap = units.reduce((result, unit) => ({ ...result, [unit.name]: unit }), {});
const buildings = [
  { id: 2, name: 'house', levels: { min: 0, max: 1 } },
  { id: 3, name: 'door', requirements: [{ item: 'house', level: 1 }], levels: { min: 0, max: 1 } },
  { id: 4, name: 'mill', levels: { min: 0, max: 1 } },
  { id: 4, name: 'storage', levels: { min: 0, max: 1 }, data: [{ storage: 1 }, { storage: 2 }] },
] as Building[];
const buildingMap = buildings.reduce((result, building) => ({ ...result, [building.name]: building }), {});

const town = Town.fromJson({
  id: 12,
  buildings: buildings.reduce((result, building) => ({ ...result, [building.name]: { level: 0, queued: 0 } }), {}),
  production: { wood: 0, clay: 0, iron: 0 },
  resources: { wood: 0, clay: 0, iron: 0 },
}, { skipValidation: true });
const townMaxed = Town.fromJson({
  ...town,
  buildings: buildings.reduce((result, building) => ({ ...result, [building.name]: { level: building.levels.max, queued: 0 } }), {}),
}, { skipValidation: true });
const townRequirements = Town.fromJson({
  ...town,
  buildings: { [buildings[1].name]: { level: 0, queued: 0 } },
}, { skipValidation: true });

// let worldData: WorldData;
let townGrowth: TownGrowth;
let clock: lolex.Clock;

beforeEach(() => {
  clock = lolex.install();
  // worldData = new WorldData(MapManager as any, TownGrowth as any);
  worldData.world = {
    ...world,
    townLastGrowth: Date.now(),
    townGrowthInterval: 1,
  } as World;
  worldData.buildings = buildings;
  worldData.buildingMap = buildingMap;
  townGrowth = worldData.townGrowth;
});
afterEach(() => {
  clock.uninstall();
});

describe('checkGrowth', () => {
  beforeEach(() => {
    jest.spyOn(townGrowth, 'checkGrowth');
  });

  it('should catch errors and recall with last timestamp', async () => {
    let shouldReject = true;
    jest.spyOn(townGrowth, 'growTowns').mockImplementation(() => {
      if (shouldReject) {
        shouldReject = false;
        return Promise.reject();
      }
      Promise.resolve();
    });

    await townGrowth.checkGrowth(Date.now() + 1);
    expect(townGrowth.checkGrowth).toHaveBeenCalledTimes(3);
  });

  it('should call growTown and schedule a new update', async () => {
    jest.spyOn(townGrowth, 'growTowns').mockImplementationOnce(() => Promise.resolve());

    await townGrowth.checkGrowth(Date.now());
    expect(townGrowth.checkGrowth).toHaveBeenCalledTimes(1);
    expect(townGrowth.growTowns).not.toHaveBeenCalled();

    clock.tick(2);
    expect(townGrowth.checkGrowth).toHaveBeenCalledTimes(2);
    expect(townGrowth.growTowns).toHaveBeenCalled();
  });
});

describe('growTowns', () => {
  let getTownsSpy;
  let rollbackSpy;
  let transactionSpy;
  beforeEach(() => {
    rollbackSpy = jest.fn();
    getTownsSpy = jest.spyOn(townQueries, 'getTowns');
    transactionSpy = jest.spyOn(transaction, 'start').mockImplementation(() => ({ rollback: rollbackSpy, commit: jest.fn() }));
  });

  it('should catch errors and rethrow them', async () => {
    const errorMessage = 'fatal error';
    getTownsSpy.mockImplementationOnce(() => { throw errorMessage; });

    let thrownError;
    try {
      await townGrowth.growTowns(1);
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toEqual(errorMessage);
    expect(rollbackSpy).toHaveBeenCalledTimes(2);
  });

  it('should update all towns with new buildings', async () => {
    jest.spyOn(townQueries, 'getTowns').mockImplementationOnce(() => [town, townMaxed]);
    jest.spyOn(townQueries, 'upsertTowns').mockImplementationOnce(() => null);
    jest.spyOn(worldData, 'updateGrowth').mockImplementationOnce(() => null);
    await townGrowth.growTowns(1);
    expect(townQueries.upsertTowns).toHaveBeenCalled();
    expect(worldData.updateGrowth).toHaveBeenCalled();
  });
});

describe('growRandomBuilding', () => {
  it('should update one random building and return buildings', () => {
    const updatedBuildings = townGrowth.growRandomBuilding(town, 3);
    expect(town.buildings).not.toEqual(buildings);

    // Array of changed levels
    const changes = Object.entries(town.buildings).reduce((result, [key, val]) => {
      const difference = updatedBuildings[key].level - val.level;
      if (difference) { result.push(difference); }

      return result;
    }, []);
    expect(changes).toEqual([1]);
  });

  it('should return null if there is nothing to update', () => {
    expect(townGrowth.growRandomBuilding(townMaxed, 1)).toEqual(null);

    // Requirements not met
    worldData.buildings = [buildings[1]];
    expect(townGrowth.growRandomBuilding(townMaxed, 1)).toEqual(null);
  });
});

describe('generateRingTowns', () => {
  let upsertTownsSpy;
  let rollbackSpy;
  let transactionSpy;
  const availableCoords: Coords[] = [[1, 3], [1, 2]];
  const townCoords: Coords[] = [[1, 3]];
  // Current seedBase generates town with [1,3] coord
  const seedBase = 'test-base';
  beforeEach(() => {
    rollbackSpy = jest.fn();
    upsertTownsSpy = jest.spyOn(townQueries, 'upsertTowns');
    transactionSpy = jest.spyOn(transaction, 'start').mockImplementation(() => ({ rollback: rollbackSpy, commit: jest.fn() }));
    jest.spyOn(worldData.mapManager, 'getAvailableCoords').mockImplementationOnce(() => (availableCoords));
  });

  it('should catch errors and return refreshed coords', async () => {
    const errorMessage = 'fatal error';
    let shouldThrow = true;
    upsertTownsSpy.mockImplementation(() => {
      if (shouldThrow) {
        shouldThrow = false;
        throw errorMessage;
      }
      return [];
    });
    jest.spyOn(townGrowth, 'generateRingTowns');

    const result = await townGrowth.generateRingTowns(townCoords, seedBase);
    expect(result).toEqual({
      towns: [],
      coords: availableCoords,
    });
    expect(worldData.mapManager.getAvailableCoords).toHaveBeenCalled();
  });

  it('should not upsert if no towns picked', async () => {
    worldData.world.barbPercent = 0;
    const result = await townGrowth.generateRingTowns(availableCoords, seedBase);
    expect(upsertTownsSpy).not.toHaveBeenCalled();
    expect(result).toEqual({
      towns: [],
      coords: availableCoords,
    });
  });

  it('should return all created towns', async () => {
    worldData.world.barbPercent = 1;
    upsertTownsSpy.mockImplementationOnce((towns) => towns);

    const result = await townGrowth.generateRingTowns(availableCoords, seedBase);
    expect(result).toEqual({
      towns: availableCoords.map((location) => ({ location })),
      coords: [],
    });
  });
});
