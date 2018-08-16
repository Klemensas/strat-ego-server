import { MovementType } from 'strat-ego-common';
import * as lolex from 'lolex';

import { TownEventQueue } from './townQueue';
import { BuildingQueue } from './building/buildingQueue';
import * as townQueries from './world/worldQueries';
import { Movement } from './town/movement';
import { UnitQueue } from './unit/unitQueue';
import { Town } from './town/town';
import { TownSocket } from './town/townSocket';

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
const queuesSorted = [...movementQueues, ...unitQueues, ...buildingQueues].sort((a, b) => +a.endsAt - +b.endsAt);

let clock: lolex.Clock;
beforeEach(async () => {
  clock = lolex.install();
  townQueue = new TownEventQueue();
  townQueue.earliestItem = buildingQueues[0];
  jest.spyOn(townQueue, 'addToQueue');
  jest.spyOn(townQueue, 'setEarliestItem');
  jest.spyOn(townQueries, 'getSortedBuildingQueues').mockImplementation(() => Promise.resolve(movementQueues));
  jest.spyOn(townQueries, 'getSortedUnitQueues').mockImplementation(() => Promise.resolve(buildingQueues));
  jest.spyOn(townQueries, 'getSortedMovements').mockImplementation(() => Promise.resolve(unitQueues));
});
afterEach(() => {
  clock.uninstall();
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
    townQueue.queue = queuesSorted;
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

describe('setEarliestItem', () => {
  let processSpy;
  beforeEach(() => {
    townQueue.queue = queuesSorted;
    processSpy = jest.spyOn(townQueue, 'processItem').mockImplementation(() => Promise.resolve());
  });

  it('should call the earliestItem timeout', () => {
    townQueue.queue = [{ endsAt: Date.now() + 1 }];
    townQueue.setEarliestItem();
    expect(townQueue.processItem).not.toHaveBeenCalled();

    clock.tick(1);
    expect(processSpy).toHaveBeenCalledTimes(1);
  });

  it('should update the earliest item', () => {
    const earliestItem = townQueue.queue[townQueue.queue.length - 1];
    const queueTimeout = townQueue.queueTimeout;
    townQueue.earliestItem = earliestItem;
    townQueue.setEarliestItem();

    expect(townQueue.earliestItem).not.toEqual(earliestItem);
    expect(townQueue.earliestItem).toEqual(townQueue.queue[0]);
    expect(townQueue.queueTimeout).not.toEqual(queueTimeout);
  });
  it('should not do anything if conditions not met', () => {
    const initialQueueTimeout = townQueue.queueTimeout;
    const initialEarliestItem = townQueue.earliestItem;

    // Exit on in progress
    townQueue.inProgress = true;
    townQueue.setEarliestItem();
    expect(townQueue.earliestItem).toEqual(initialEarliestItem);
    expect(townQueue.queueTimeout).toEqual(initialQueueTimeout);

    // Exit on empty queue
    townQueue.inProgress = false;
    townQueue.queue = [];
    townQueue.setEarliestItem();
    expect(townQueue.earliestItem).toEqual(initialEarliestItem);
    expect(townQueue.queueTimeout).toEqual(initialQueueTimeout);

    // Exit on matching item length
    townQueue.inProgress = false;
    townQueue.queue = [{ endsAt: initialEarliestItem.endsAt }] as any;
    townQueue.setEarliestItem();
    expect(townQueue.earliestItem).toEqual(initialEarliestItem);
    expect(townQueue.queueTimeout).toEqual(initialQueueTimeout);
  });
});

describe('processItem', () => {
  const processingResult = { town: { id: 1 } };
  beforeEach(() => {
    jest.spyOn(townQueue, 'processItem');
  });

  it('should notify town and remove process item', async () => {
    jest.spyOn(TownSocket, 'emitToTownRoom').mockImplementation(() => null);
    jest.spyOn(townQueue, 'removeFromQueue');
    jest.spyOn(Town, 'processTownQueues').mockImplementation(() => Promise.resolve(processingResult));

    const initialEarliest = townQueue.earliestItem;
    await townQueue.processItem();

    expect(TownSocket.emitToTownRoom).toHaveBeenCalled();
    expect(townQueue.removeFromQueue).toHaveBeenCalled();
    expect(townQueue.earliestItem).not.toEqual(initialEarliest);
  });

  it('should retry on fail', async () => {
    let firstCall = true;
    jest.spyOn(TownSocket, 'emitToTownRoom').mockImplementation(() => null);
    jest.spyOn(Town, 'processTownQueues').mockImplementation(() => {
      if (firstCall) {
        firstCall = false;
        return Promise.reject();
      }
      return Promise.resolve(processingResult);
    });
    await townQueue.processItem();
    expect(townQueue.processItem).toHaveBeenCalledTimes(2);
  });

  it('should throw on more fails than allowed', async () => {
    jest.spyOn(Town, 'processTownQueues').mockImplementation(() => Promise.reject());
    let errored = false;
    try {
      await townQueue.processItem();
    } catch (err) {
      errored = true;
    }
    expect(townQueue.processItem).toHaveBeenCalledTimes(townQueue.maxAttempts);
    expect(errored).toBeTruthy();
  });
});
