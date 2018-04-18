import { MapTown, Coords } from 'strat-ego-common';

import { MapManager } from './mapManager';
import { worldData } from '../world/worldData';
import { QueryBuilder } from 'objection';
import { Town } from '../town/town';
import { knexDb } from '../../sqldb';

let mapManager: MapManager;
beforeEach(() => {
  mapManager = new MapManager(worldData);
});

test('getAllData should return mapData', () => {
  const mapTown: MapTown = {
    id: 1,
    name: 'name',
    location: [400, 401],
    owner: { id: 2, name: 'test' },
    alliance: { id: 3, name: 'test alliance' },
    score: 5,
  };
  const testMapData = {
    test: mapTown,
  };
  mapManager.mapData = testMapData;
  expect(mapManager.getAllData()).toBe(testMapData);
});

describe('map expansion', () => {
  let increaseSpy;
  beforeEach(() => {
    increaseSpy = jest.spyOn(worldData, 'increaseRing').mockImplementation(() => {
      worldData.world = {
        currentRing: 2,
        lastExpansion: Date.now(),
      } as any;
      return Promise.resolve();
    });
  });

  test('expandRing should call increase ring and update expansion date', async () => {
    const prevExpansion = Date.now() - 1;
    mapManager.lastExpansion = prevExpansion;
    await mapManager.expandRing();
    expect(worldData.increaseRing).toHaveBeenCalledTimes(1);
    expect(mapManager.lastExpansion).toBeGreaterThan(+prevExpansion);
  });

  describe('getAvailableCoords', () => {
    const testCoords: Coords[] = [
      [500 , 499],
      [500 , 500],
      [500 , 501],
      [499 , 499],
      [499 , 500],
      [499 , 501],
    ];
    const usedCoords = [
      [500, 500],
      [499, 499],
      [499, 501],
    ];
    beforeEach(async () => {
      return await Town.query(knexDb.world).insertGraph(usedCoords.map((location: Coords) => ({ location })));
    });
    test('should return only available coords ', async () => {
      const checkedCoords = testCoords.slice(2);
      const omitted = testCoords.slice(0, 2);
      const result = await mapManager.getAvailableCoords(checkedCoords);
      expect(result).toEqual(checkedCoords.filter((coord) => !usedCoords.some((used) => used.join(',') === coord.join(','))));
      expect(result.some((coord) => omitted.some((missing) => missing.join(',') === coord.join(',')))).toBeFalsy();
    });
    afterEach(async () => {
      return await Town.query(knexDb.world).del();
    });
  });
});
