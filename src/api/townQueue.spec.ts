import { TownEventQueue } from './townQueue';
import { MovementType } from 'strat-ego-common';
import { BuildingQueue } from './building/buildingQueue';
import * as townQueries from './world/worldQueries';
import { Movement } from './town/movement';
import { UnitQueue } from './unit/unitQueue';

let townQueue: TownEventQueue;

const movementQueues = [Movement.fromJson({
  id: 1,
  type: MovementType.attack,
  units: { axe: 5 },
  endsAt: Date.now() - 2,
}), Movement.fromJson({
  id: 2,
  type: MovementType.attack,
  units: { axe: 5 },
  endsAt: Date.now(),
}), Movement.fromJson({
  id: 3,
  type: MovementType.attack,
  units: { axe: 5 },
  endsAt: Date.now() + 1,
})];
const unitQueues = [UnitQueue.fromJson({
  id: 1,
  name: 'axe',
  amount: 3,
  recruitTime: 1000,
  endsAt: Date.now() - 1,
}), UnitQueue.fromJson({
  id: 2,
  name: 'axe',
  amount: 3,
  recruitTime: 1000,
  endsAt: Date.now(),
}), UnitQueue.fromJson({
  id: 6,
  name: 'axe',
  amount: 3,
  recruitTime: 1000,
  endsAt: Date.now() + 1,
})];
const buildingQueues = [BuildingQueue.fromJson({
  id: 7,
  name: 'barracks',
  level: 3,
  buildTime: 1000,
  endsAt: Date.now() - 1,
}), BuildingQueue.fromJson({
  id: 4,
  name: 'barracks',
  level: 3,
  buildTime: 1000,
  endsAt: Date.now(),
}), BuildingQueue.fromJson({
  id: 3,
  name: 'barracks',
  level: 3,
  buildTime: 1000,
  endsAt: Date.now() + 1,
})];

beforeEach(async () => {
  townQueue = new TownEventQueue();
  townQueue.earliestItem = buildingQueues[0];
  jest.spyOn(townQueue, 'addToQueue');
  jest.spyOn(townQueue, 'setEarliestItem');
  jest.spyOn(townQueue, 'processItem').mockImplementation(() => Promise.resolve());
  jest.spyOn(townQueries, 'getSortedBuildingQueues').mockImplementation(() => Promise.resolve(movementQueues));
  jest.spyOn(townQueries, 'getSortedUnitQueues').mockImplementation(() => Promise.resolve(buildingQueues));
  jest.spyOn(townQueries, 'getSortedMovements').mockImplementation(() => Promise.resolve(unitQueues));
});

it('loadQueues should add all items to queue and call set earliest', async () => {
  townQueue.inProgress = true;
  await townQueue.loadQueues();
  expect(townQueue.queue.length).toBeGreaterThan(0);
  expect(townQueue.addToQueue).toHaveBeenCalledTimes(townQueue.queue.length);
  expect(townQueue.setEarliestItem).toHaveBeenCalledTimes(townQueue.queue.length + 1);
});

describe('removeFromQueue', () => {
  beforeEach(() => {
    townQueue.queue = [...movementQueues, ...unitQueues, ...buildingQueues].sort((a, b) => +a.endsAt - +b.endsAt);
  });

  it('should remove the given items from queue', () => {
    const initialLength = townQueue.queue.length;
    const removedQueues = [movementQueues[0], unitQueues[1]];

    townQueue.removeFromQueue(...removedQueues);
    expect(townQueue.queue.length).toEqual(initialLength - removedQueues.length);
    expect(townQueue.queue.some((item) =>
      removedQueues.some((removed) =>
        removed.id === item.id && removed.constructor.name === item.constructor.name,
      ),
    )).toBeFalsy();
  });

  it('should refresh earliestItem', () => {
    const removedQueues = [townQueue.queue[1], townQueue.queue[2]];
    const earliestItem = townQueue.queue[0];
    townQueue.earliestItem = earliestItem;
    townQueue.removeFromQueue(...removedQueues);
    expect(townQueue.earliestItem).toEqual(earliestItem);

    townQueue.removeFromQueue(earliestItem);
    expect(townQueue.earliestItem).not.toEqual(earliestItem);
  });
});
