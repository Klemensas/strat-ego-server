import { test } from 'ava';

import { mapManager } from './mapManager';
import { MapTown } from 'strat-ego-common';

test('getAllData should return mapData', (t) => {
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
  t.is(mapManager.getAllData(), testMapData);
});
