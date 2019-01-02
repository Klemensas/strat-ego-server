import { MapTown, Coords, Dict } from 'strat-ego-common';
import * as lolex from 'lolex';

import { WorldData } from '../world/worldData';
import { MapManager } from './mapManager';
import { Town } from '../town/town';
import { World } from '../world/world';
import * as townQueries from '../town/townQueries';
import { TownGrowth } from '../town/townGrowth';
import { ProfileService } from '../profile/profileService';

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
let worldData: WorldData;
beforeEach(() => {
  clock = lolex.install();
  worldData = new WorldData(MapManager, TownGrowth);
  mapManager = worldData.mapManager;
});
afterEach(() => {
  clock.uninstall();
});

describe('initialize', () => {
  const lastExpansion = Date.now();
  const expansionRate = 1;
  const expansionGrowth = -55;

  beforeEach(() => {
    worldData.world = {
      lastExpansion,
      expansionRate,
      expansionGrowth,
    } as World;
    jest.spyOn(mapManager, 'addTown');
    jest.spyOn(mapManager, 'scheduleExpansion').mockImplementationOnce(() => Promise.resolve());
    jest.spyOn(ProfileService, 'getTownProfile').mockImplementation(() => Promise.resolve(plainTowns));
  });

  it('should set variables and load towns', async () => {
    await mapManager.initialize();
    expect(mapManager.lastExpansion).toEqual(lastExpansion);
    expect(mapManager.expansionRate).toEqual(expansionRate);
    expect(mapManager.expansionGrowth).toEqual(expansionGrowth);
    expect(mapManager.scheduleExpansion).toHaveBeenCalledTimes(1);
    expect(mapManager.addTown).toHaveBeenCalledWith(...plainTowns);
  });
});

it('getAllData should return mapData', () => {
  const mapTown: Dict<number> = {
    1: 2,
    3: 4,
  };
  mapManager.mapData = mapTown;
  expect(mapManager.getAllData()).toBe(mapTown);
});

it('addTown should add all player towns', () => {
  const mapData: Dict<number> = {
    '500,500': 500,
    '501,501': 501,
    '502,502': 502,
  };
  const testAlliance = { id: 3, name: 'yes' };
  const testPlayer = {
    id: 1,
    name: 'test',
    alliance: testAlliance,
    towns: [],
  };
  const townsToAdd = plainTowns.map(((town) => ({ ...town, player: testPlayer } as Town)));
  const addedTowns = plainTowns.reduce((result, { location, id }) => ({ ...result, [location.join(',')]: id }), {});

  mapManager.mapData = mapData;

  mapManager.addTown();
  expect(mapManager.mapData).toEqual(mapData);

  const expected: Dict<MapTown> = { ...mapData, ...addedTowns };
  mapManager.addTown(...townsToAdd);
  expect(mapManager.mapData).toEqual(expected);
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
        ...worldData.world,
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

    it('should pick a random coordinate from available ones', async () => {
      mapManager.availableCoords = [...availableCoords];
      expect(mapManager.availableCoords).toEqual(availableCoords);

      const coord = await mapManager.chooseLocation();
      expect(availableCoords.includes(coord)).toBeTruthy();

      const expectedCoords = availableCoords.filter((c) => c.join(',') !== coord.join(','));
      expect(mapManager.availableCoords).toEqual(expectedCoords);
    });
    it('should expand the ring if no coordinates are available', async () => {
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
    beforeEach(() => {
      mapManager.expansionGrowth = 1;
      worldData.world = {
        ...worldData.world,
        currentRing: 1,
      } as World;
      jest.spyOn(mapManager, 'scheduleExpansion');
      jest.spyOn(mapManager, 'expandRing').mockImplementation(() => {
        mapManager.lastExpansion = Date.now() + 1000;
        return Promise.resolve();
      });
    });

    it('should call expandRing and reschedule if time is up', async () => {
      mapManager.expansionRate = 0;
      mapManager.lastExpansion = Date.now();

      await mapManager.scheduleExpansion();
      expect(mapManager.expandRing).toHaveBeenCalledTimes(1);
      expect(mapManager.scheduleExpansion).toHaveBeenCalledTimes(2);
    });
  });

  it('getRingCoords should return accurate ring coords', () => {
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

  it('getCoordsInRange should return accurate ring coords', () => {
    const expectedRange = [
      [2, 1], [3, 1], [4, 1],
      [1, 2], [2, 2], [3, 2], [4, 2],
      [1, 3], [2, 3], [5, 3], [4, 3],
      [1, 4], [2, 4], [3, 4], [4, 4],
      [2, 5], [3, 5], [4, 5],
    ];
    expect(mapManager.getCoordsInRange(2, 2, 3)).toEqual(expectedRange);
  });

  describe('expandRing', () => {
    const coords = [[2, 20], [1, 2], [1, 1], [1, 4], [2, 5], [2, 1]];
    const leftoverCoords = coords.filter((coord) => !coord.includes(2));
    const newTowns = [{
      id: 112,
      name: 'town #112',
      location: [12, 11],
      score: 112,
    }, {
      id: 234,
      player: {
        id: 11,
        name: 'player #11',
      },
      name: 'town #234',
      location: [34, 23],
      score: 234,
    }];
    beforeEach(() => {
      // mapManager.mapData = {
      //   ['1,1']: { owner: null, alliance: null, id: 1, name: 'test #1', location: [1, 1], score: 1 },
      // };
      worldData.world = {
        ...worldData.world,
        currentRing: 1,
      } as World;
      jest.spyOn(mapManager, 'scheduleExpansion');
      jest.spyOn(mapManager, 'addTown');
      jest.spyOn(mapManager, 'getAvailableCoords').mockImplementation(() => Promise.resolve([...coords]));
      jest.spyOn(worldData.townGrowth, 'generateRingTowns').mockImplementation(() => Promise.resolve({
        towns: newTowns,
        coords: leftoverCoords,
      }));
    });

    it('should call increase ring and update expansion date', async () => {
      const prevExpansion = Date.now() - 1;
      mapManager.lastExpansion = prevExpansion;
      await mapManager.expandRing();
      expect(worldData.increaseRing).toHaveBeenCalledTimes(1);
      expect(mapManager.lastExpansion).toBeGreaterThan(+prevExpansion);
    });

    it('should update coords and add new towns', async () => {
      mapManager.expansionRate = 1;

      await mapManager.expandRing();

      expect(mapManager.addTown).toHaveBeenCalledWith(...newTowns);
      expect(mapManager.availableCoords).toEqual(leftoverCoords);
    });
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
    beforeEach( () => {
      jest.spyOn(townQueries, 'getTownLocationsByCoords').mockImplementationOnce(() => Promise.resolve(usedCoords.map((location: Coords) => ({ location }))));
    });

    it('should return only available coords ', async () => {
      const checkedCoords = testCoords.slice(2);
      const omitted = testCoords.slice(0, 2);
      const result = await mapManager.getAvailableCoords(checkedCoords);
      expect(result).toEqual(checkedCoords.filter((coord) => !usedCoords.some((used) => used.join(',') === coord.join(','))));
      expect(result.some((coord) => omitted.some((missing) => missing.join(',') === coord.join(',')))).toBeFalsy();
    });
  });
});
