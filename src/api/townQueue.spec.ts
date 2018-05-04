import { TownEventQueue } from './townQueue';
import { MovementType } from 'strat-ego-common';
import { BuildingQueue } from './building/buildingQueue';
import * as townQueries from './world/worldQueries';

let townQueue: TownEventQueue;
let addSpy;
let setEalierSpy;
let processSpy;
const movementQueues = [{
  id: 1,
  type: MovementType.attack,
  units: { axe: 5 },
  endsAt: Date.now() - 1,
}, {
  id: 2,
  type: MovementType.attack,
  units: { axe: 5 },
  endsAt: Date.now(),
}, {
  id: 3,
  type: MovementType.attack,
  units: { axe: 5 },
  endsAt: Date.now() + 1,
}];
const unitQueues = [{
  id: 4,
  name: 'axe',
  amount: 3,
  recruitTime: 1000,
  endsAt: Date.now() - 1,
}, {
  id: 5,
  name: 'axe',
  amount: 3,
  recruitTime: 1000,
  endsAt: Date.now(),
}, {
  id: 6,
  name: 'axe',
  amount: 3,
  recruitTime: 1000,
  endsAt: Date.now() + 1,
}];
const buildingQueues = [{
  id: 7,
  name: 'barracks',
  level: 3,
  buildTime: 1000,
  endsAt: Date.now() - 1,
}, {
  id: 8,
  name: 'barracks',
  level: 3,
  buildTime: 1000,
  endsAt: Date.now(),
}, {
  id: 9,
  name: 'barracks',
  level: 3,
  buildTime: 1000,
  endsAt: Date.now() + 1,
}];

beforeEach(async () => {
  townQueue = new TownEventQueue();
  addSpy = jest.spyOn(townQueue, 'addToQueue');
  setEalierSpy = jest.spyOn(townQueue, 'setEarliestItem');
  processSpy = jest.spyOn(townQueue, 'processItem').mockImplementation(() => Promise.resolve());
  jest.spyOn(townQueries, 'getSortedBuildingQueues').mockImplementation(() => Promise.resolve(movementQueues));
  jest.spyOn(townQueries, 'getSortedUnitQueues').mockImplementation(() => Promise.resolve(buildingQueues));
  jest.spyOn(townQueries, 'getSortedMovements').mockImplementation(() => Promise.resolve(unitQueues));
});

test('loadQueues should add all items to queue and call set earliest', async () => {
  townQueue.inProgress = true;
  await townQueue.loadQueues();
  expect(townQueue.queue.length).toBeGreaterThan(0);
  expect(townQueue.addToQueue).toHaveBeenCalledTimes(townQueue.queue.length + 1);
  expect(townQueue.setEarliestItem).toHaveBeenCalledTimes(townQueue.queue.length + 2);
});
