import { WorldData } from '../world/worldData';
import { World } from '../world/world';
import * as worldQueries from '../world/worldQueries';
import { Unit } from '../unit/unit';
import { Building } from '../building/building';
import { knexDb } from '../../sqldb';
import { MapManager } from '../map/mapManager';
// import * as map from '../map/mapManager';

const world = { name: 'test' } as World;
const units = [{ id: 1, name: 'sworder' }] as Unit[];
const unitMap = units.reduce((result, unit) => ({ ...result, [unit.name]: unit }), {});
const buildings = [{ id: 2, name: 'house' }] as Building[];
const buildingMap = buildings.reduce((result, building) => ({ ...result, [building.name]: building }), {});
let worldData: WorldData;

class TestManager {
  constructor() {}
  initialize() { return Promise.resolve(); }
  checkGrowth() { return jest.fn().mockImplementation(() => Promise.resolve()); }
}

beforeEach(() => {
  worldData = new WorldData(TestManager as any, TestManager as any);
});

describe('fullWorld', () => {
  it('should return current values', () => {
    worldData.world = world;
    worldData.units = units;
    worldData.unitMap = unitMap;
    worldData.buildings = buildings;
    worldData.buildingMap = buildingMap;

    expect(worldData.fullWorld).toEqual({
      world,
      units,
      unitMap,
      buildings,
      buildingMap,
    });

    world.speed = 9999;
    world.size = 1;

    expect(worldData.fullWorld).toEqual({
      world,
      units,
      unitMap,
      buildings,
      buildingMap,
    });
  });
});

describe('initialize', () => {
  let getWorldSpy;
  let getBuildingsSpy;
  let getUnitsSpy;
  beforeEach(() => {
    getWorldSpy = jest.spyOn(worldQueries, 'getWorld');
    getBuildingsSpy = jest.spyOn(worldQueries, 'getBuildings');
    getUnitsSpy = jest.spyOn(worldQueries, 'getUnits');
  });

  it('should catch and rethrow errors', async () => {
    const error = 'fatal error';
    getWorldSpy.mockImplementationOnce(() => Promise.resolve([]));
    getUnitsSpy.mockImplementationOnce(() => Promise.resolve([]));
    getBuildingsSpy.mockImplementationOnce(() => Promise.reject(error));

    let result;
    try {
      await worldData.initialize('test');
    } catch (err) {
      result = err;
    }
    expect(result).toEqual(error);
  });

  it('should set world values', async () => {
    getWorldSpy.mockImplementationOnce(() => Promise.resolve(world));
    getUnitsSpy.mockImplementationOnce(() => Promise.resolve(units));
    getBuildingsSpy.mockImplementationOnce(() => Promise.resolve(buildings));

    expect(worldData.world).toEqual(undefined);
    expect(worldData.units).toEqual([]);
    expect(worldData.unitMap).toEqual({});
    expect(worldData.buildings).toEqual([]);
    expect(worldData.buildingMap).toEqual({});

    await worldData.initialize('test');

    expect(worldData.world).toEqual(world);
    expect(worldData.units).toEqual(units);
    expect(worldData.unitMap).toEqual(unitMap);
    expect(worldData.buildings).toEqual(buildings);
    expect(worldData.buildingMap).toEqual(buildingMap);
  });
});

describe('increaseRing', () => {
  let updateWorldSpy;
  beforeEach(() => {
    updateWorldSpy = jest.spyOn(worldQueries, 'updateWorld');
  });

  it('shuld catch and rethrow errors', async () => {
    const error = 'thrown error';
    updateWorldSpy.mockImplementationOnce(() => Promise.reject(error));
    worldData.world = { currentRing: 1 } as World;

    let result;
    try {
      await worldData.increaseRing();
    } catch (err) {
      result = error;
    }
    expect(result).toEqual(error);
  });
});

describe('updateGrowth', () => {
  it('should call updateWorld', async () => {
    jest.spyOn(worldQueries, 'updateWorld').mockImplementationOnce(() => Promise.resolve());

    worldData.world = { townLastGrowth: 2, townGrowthInterval: 1 } as World;
    await worldData.updateGrowth();
    expect(worldQueries.updateWorld).toHaveBeenCalledWith(worldData.world, { townLastGrowth: 3 }, knexDb.main);
  });
});
