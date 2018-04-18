import { TownEventQueue } from './townQueue';
import { knexDb } from '../sqldb';
import { Movement } from './town/movement';
import { MovementType } from 'strat-ego-common';
import { Building } from './building/building';
import { BuildingQueue } from './building/buildingQueue';
import { UnitQueue } from './unit/unitQueue';

let townQueue: TownEventQueue;
let addSpy;
let setEalierSpy;
let processSpy;
const movementQueues = [{
  type: MovementType.attack,
  units: { axe: 5 },
  endsAt: Date.now() - 1,
}, {
  type: MovementType.attack,
  units: { axe: 5 },
  endsAt: Date.now(),
}, {
  type: MovementType.attack,
  units: { axe: 5 },
  endsAt: Date.now() + 1,
}];
const unitQueues = [{
  name: 'axe',
  amount: 3,
  recruitTime: 1000,
  endsAt: Date.now() - 1,
}, {
  name: 'axe',
  amount: 3,
  recruitTime: 1000,
  endsAt: Date.now(),
}, {
  name: 'axe',
  amount: 3,
  recruitTime: 1000,
  endsAt: Date.now() + 1,
}];
const buildingQueues = [{
  name: 'barracks',
  level: 3,
  buildTime: 1000,
  endsAt: Date.now() - 1,
}, {
  name: 'barracks',
  level: 3,
  buildTime: 1000,
  endsAt: Date.now(),
}, {
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

  return await Promise.all([
    Movement.query(knexDb.world).insert(movementQueues),
    BuildingQueue.query(knexDb.world).insert(buildingQueues),
    UnitQueue.query(knexDb.world).insert(unitQueues),
  ]);
});
afterEach(async () => {
  return await Promise.all([
    Movement.query(knexDb.world).del(),
    BuildingQueue.query(knexDb.world).del(),
    UnitQueue.query(knexDb.world).del(),
  ]);
});

test('loadQueues should add all items to queue and call set earliest', async () => {
  townQueue.inProgress = true;
  await townQueue.loadQueues();
  expect(townQueue.queue.length).toBeGreaterThan(0);
  expect(townQueue.addToQueue).toHaveBeenCalledTimes(townQueue.queue.length + 1);
  expect(townQueue.setEarliestItem).toHaveBeenCalledTimes(townQueue.queue.length + 2);
});
