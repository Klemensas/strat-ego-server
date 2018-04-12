import { MapTown } from 'strat-ego-common';

import { mapManager } from './mapManager';

test('getAllData should return mapData', () => {
  const mapTown: MapTown = {
    id: 1,
    name: 'name',
    location: [400, 401],
    owner: { id: 2, name: 'test' },
    alliance: { id: 3, name: 'test alliance' },
  };
  const testMapData = {
    test: mapTown,
  };
  mapManager.mapData = testMapData;
  expect(mapManager.getAllData()).toBe(testMapData);
});
