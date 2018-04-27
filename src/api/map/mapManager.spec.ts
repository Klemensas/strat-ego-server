import { MapTown, Coords, Dict } from 'strat-ego-common';
import * as lolex from 'lolex';

import { MapManager } from './mapManager';
import { worldData } from '../world/worldData';
import { QueryBuilder } from 'objection';
import { Town } from '../town/town';
import { knexDb } from '../../sqldb';
import { World } from '../world/world';

let mapManager: MapManager;
const plainTowns = [{
  id: 123,
  location: [123, 123],
  name: 'town #123',
  score: 123,
  player: null,
}, {
  id: 124,
  location: [124, 124],
  name: 'town #124',
  score: 124,
  player: null,
}, {
  id: 125,
  location: [125, 125],
  name: 'town #125',
  score: 125,
  player: null,
}] as Town[];

let clock: lolex.Clock;
beforeEach(() => {
  clock = lolex.install();
  mapManager = new MapManager(worldData);
});
afterEach(() => {
  clock.uninstall();
});

describe('initialize', () => {
  const lastExpansion = Date.now();
  const expansionRate = 1;
  const expansionGrowth = -55;
  let addSpy;
  let expandSpy;

  beforeEach(async () => {
    worldData.world = {
      lastExpansion,
      expansionRate,
      expansionGrowth,
    } as World;
    addSpy = jest.spyOn(mapManager, 'addTown');
    expandSpy = jest.spyOn(mapManager, 'scheduleExpansion').mockImplementation(() => Promise.resolve());
    await Town.query(knexDb.world).insertGraph(plainTowns);
  });
  afterEach(async () => {
    return await Town.query(knexDb.world).del();
  });

  test('initialize should set variables and load towns', async () => {
    await mapManager.initialize();
    expect(mapManager.lastExpansion).toEqual(lastExpansion);
    expect(mapManager.expansionRate).toEqual(expansionRate);
    expect(mapManager.expansionGrowth).toEqual(expansionGrowth);
    expect(mapManager.scheduleExpansion).toHaveBeenCalledTimes(1);
    expect(mapManager.addTown).toHaveBeenCalledWith(...plainTowns);
  });
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

describe('town editing', () => {
  const mapData: Dict<MapTown> = {
    '500,500': { id: 500, name: 'town #500', location: [500, 500], score: 500, owner: null, alliance: null },
    '501,501': { id: 501, name: 'town #501', location: [501, 501], score: 501, owner: null , alliance: null},
    '502,502': { id: 502, name: 'town #502', location: [502, 502], score: 502, owner: null , alliance: null},
  };
  const testAlliance = { id: 3, name: 'yes' };
  const testPlayer = {
    id: 1,
    name: 'test',
    alliance: testAlliance,
    towns: [],
  };
  const townsToAdd = plainTowns.map(((town) => ({ ...town, player: testPlayer } as Town)));
  const mapTowns: Dict<MapTown> = townsToAdd.reduce((result, item) => ({
    ...result,
    [item.location.join(',')]: {
      owner: { id: testPlayer.id, name: testPlayer.name},
      alliance: testPlayer.alliance,
      id: item.id,
      name: item.name,
      location: item.location,
      score: item.score,
    },
  }), {});
  beforeEach(() => {
    mapManager.mapData = { ...mapData };
  });

  test('addPlayerTowns should add all player towns', () => {
    mapManager.addPlayerTowns(testPlayer);
    expect(mapManager.mapData).toEqual(mapData);

    mapManager.addPlayerTowns({
      ...testPlayer,
      towns: townsToAdd,
    });
    const expected: Dict<MapTown> = { ...mapData, ...mapTowns };
    expect(mapManager.mapData).toEqual(expected);
  });
  test('addTown should add all player towns', () => {
    mapManager.addTown();
    expect(mapManager.mapData).toEqual(mapData);

    const expected: Dict<MapTown> = { ...mapData, ...mapTowns };
    mapManager.addTown(...townsToAdd);
    expect(mapManager.mapData).toEqual(expected);
  });
  describe('setTownAlliance', () => {
    test('should ignore missing towns', () => {
      mapManager.setTownAlliance({ id: 123, name: 'notused' }, [-2, 324567]);
      expect(mapManager.mapData).toEqual(mapData);
    });

    test('should unset all provided town alliance', () => {
      mapManager.mapData = { ...mapTowns };
      const nonAlliedTowns = townsToAdd.slice(0, townsToAdd.length - 1).map(({ id }) => id);
      const expected = Object.values(mapTowns).reduce((result, town) => ({
        ...result,
        [town.location.join(',')]: {
          ...town,
          alliance: nonAlliedTowns.includes(town.id) ? null : town.alliance,
        },
      }), {});

      mapManager.setTownAlliance(null, nonAlliedTowns);
      expect(mapManager.mapData).toEqual(expected);
    });

    test('should set all provided town alliance', () => {
      const alliedTowns = Object.values(mapData).map(({ id }) => id).slice(1);
      const expected = Object.values(mapData).reduce((result, town) => ({
        ...result,
        [town.location.join(',')]: {
          ...town,
          alliance: alliedTowns.includes(town.id) ? testAlliance : null,
        },
      }), {});
      mapManager.setTownAlliance(testAlliance, alliedTowns);
      expect(mapManager.mapData).toEqual(expected);
    });
  });

  describe('setTownScore', () => {
    test('should ignore missing towns', () => {
      const target: Coords = [-123, -123];
      expect(mapManager.mapData).toEqual(mapData);
      mapManager.setTownScore(-1, target);
      expect(mapManager.mapData).toEqual(mapData);
    });
    test('should update target town score', () => {
      const target = Object.values(mapData)[0].location;
      const expected = 12343;
      expect(mapManager.mapData[target.join(',')].score).not.toEqual(expected);
      mapManager.setTownScore(expected, target);
      expect(mapManager.mapData[target.join(',')].score).toEqual(expected);
    });
  });
});

describe('map expansion', () => {
  const minCoords = {
    top: [[2, 1], [3, 1], [4, 1]],
    right: [[4, 2], [5, 3], [4, 4]],
    left: [[1, 2], [1, 3], [1, 4]],
    bottom: [[2, 5], [3, 5], [4, 5]],
  };
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

  describe('chooseLocation', () => {
    const availableCoords: Coords[] = [
      [1, 1],
      [1, 2],
      [1, 3],
    ];

    test('should pick a random coordinate from available ones', async () => {
      mapManager.availableCoords = [...availableCoords];
      expect(mapManager.availableCoords).toEqual(availableCoords);

      const coord = await mapManager.chooseLocation();
      expect(availableCoords.includes(coord)).toBeTruthy();

      const expectedCoords = availableCoords.filter((c) => c.join(',') !== coord.join(','));
      expect(mapManager.availableCoords).toEqual(expectedCoords);
    });
    test('should expand the ring if no coordinates are available', async () => {
      const chooseSpy = jest.spyOn(mapManager, 'chooseLocation');
      const expandSpy = jest.spyOn(mapManager, 'expandRing').mockImplementation(() => {
        mapManager.availableCoords = [...availableCoords];
        return Promise.resolve();
      });

      const coord = await mapManager.chooseLocation();
      const expectedCoords = availableCoords.filter((c) => c.join(',') !== coord.join(','));
      expect(mapManager.availableCoords).toEqual(expectedCoords);
      expect(mapManager.expandRing).toHaveBeenCalled();
      expect(mapManager.chooseLocation).toHaveBeenCalledTimes(2);

    });
  });
  describe('scheduleExpansion', () => {
    const coords = [[1, 1], [1, 2]];
    let scheduleSpy;
    let coordSpy;
    let expandSpy;
    beforeEach(() => {
      mapManager.expansionGrowth = 1;
      worldData.world = {
        currentRing: 1,
      } as World;
      scheduleSpy = jest.spyOn(mapManager, 'scheduleExpansion');
      coordSpy = jest.spyOn(mapManager, 'getAvailableCoords').mockImplementation(() => Promise.resolve([...coords]));
      expandSpy = jest.spyOn(mapManager, 'expandRing').mockImplementation(() => {
        mapManager.lastExpansion = Date.now() + 1000;
        return Promise.resolve();
      });
    });

    test('should call expandRing and reschedule if time is up', async () => {
      mapManager.expansionRate = 0;
      mapManager.lastExpansion = Date.now();

      await mapManager.scheduleExpansion();
      expect(mapManager.expandRing).toHaveBeenCalledTimes(1);
      expect(mapManager.scheduleExpansion).toHaveBeenCalledTimes(2);
    });

    test('should update coords and schedule the next expansion', async () => {
      mapManager.expansionRate = 1;
      mapManager.lastExpansion = Date.now();

      await mapManager.scheduleExpansion();
      expect(mapManager.expandRing).not.toHaveBeenCalled();
      expect(mapManager.scheduleExpansion).toHaveBeenCalledTimes(1);
      expect(mapManager.availableCoords).toEqual(coords);

      clock.tick(1);
      expect(mapManager.expandRing).toHaveBeenCalledTimes(1);
      expect(mapManager.scheduleExpansion).toHaveBeenCalledTimes(2);
    });

  //   test('should update isExpanded when scheduling', async () => {
  //     expandSpy.mockImplementation(() => new Promise((resolve) => setTimeout(() => {
  //       mapManager.lastExpansion = Date.now() + 1000;
  //       resolve();
  //     }, 500)));
  //     mapManager.expansionRate = 2;
  //     mapManager.lastExpansion = Date.now();

  //     await mapManager.scheduleExpansion();
  //     expect(mapManager.scheduleExpansion).toHaveBeenCalledTimes(1);

  //     let expandedResolved = false;
  //     jest.advanceTimersByTime(1);
  //     mapManager.isExpanded.then(() => expandedResolved = true);
  //     expect(mapManager.scheduleExpansion).toHaveBeenCalledTimes(2);
  //     expect(expandedResolved).toBeFalsy();

  //     jest.advanceTimersByTime(550);
  //     expect(expandedResolved).toBeTruthy();
  //     expect(mapManager.expandRing).toHaveBeenCalledTimes(1);
  //     expect(mapManager.scheduleExpansion).toHaveBeenCalledTimes(2);

  //   });
  });

  test('getRingCoords should return accurate ring coords', () => {
    let coords = mapManager.getRingCoords(3, 2);
    let expected = { ...minCoords };
    expect(coords).toEqual(expected);

    coords = mapManager.getRingCoords(500, 5);
    expected = {
      bottom: [[497, 505], [498, 505], [499, 505], [500, 505], [501, 505], [502, 505]],
      left: [[497, 496], [496, 497], [496, 498], [495, 499], [495, 500], [495, 501], [496, 502], [496, 503], [497, 504]],
      right: [[503, 496], [503, 497], [504, 498], [504, 499], [505, 500], [504, 501], [504, 502], [503, 503], [503, 504]],
      top: [[497, 495], [498, 495], [499, 495], [500, 495], [501, 495], [502, 495]],
    };
    expect(coords).toEqual(expected);
  });

  test('getCoordsInRange should return accurate ring coords', () => {
    const expectedRange = [
      [2, 1], [3, 1], [4, 1],
      [1, 2], [2, 2], [3, 2], [4, 2],
      [1, 3], [2, 3], [5, 3], [4, 3],
      [1, 4], [2, 4], [3, 4], [4, 4],
      [2, 5], [3, 5], [4, 5],
    ];
    expect(mapManager.getCoordsInRange(2, 2, 3)).toEqual(expectedRange);
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
