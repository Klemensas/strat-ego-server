import { BuildingQueue } from './building/buildingQueue';
import { UnitQueue } from './unit/unitQueue';
import { Movement } from './town/movement';
import { Town, TownQueue } from './town/town';
import { TownSocket } from './town/townSocket';
import { logger } from '../logger';
import { getSortedBuildingQueues, getSortedUnitQueues, getSortedMovements } from './world/worldQueries';

export class TownEventQueue {
  maxAttempts = 3;
  queue: TownQueue[] = [];
  earliestItem: TownQueue;
  queueTimeout: NodeJS.Timer;
  inProgress = false;

  public async loadQueues() {
    const [buildingQueues, unitQueues, movements] = await Promise.all([
      getSortedBuildingQueues(),
      getSortedUnitQueues(),
      getSortedMovements(),
    ]);

    this.inProgress = true;
    [...buildingQueues, ...unitQueues, ...movements].forEach((item) => this.addToQueue(item));
    this.inProgress = false;
    this.setEarliestItem();
    return;
  }

  // TODO: might want to improve this part
  // Sort provided items, then loop through current items to find earlier item and insert there
  public addToQueue(item: TownQueue | TownQueue[]) {
    const target = item instanceof Array ? item.shift() : item;
    // Enforce number type to prevent string and number comparison
    target.endsAt = +target.endsAt;

    const closerToBeggining = this.queue.length < 3 ? true : (this.queue[0].endsAt + this.queue[this.queue.length - 1].endsAt) / 2 > target.endsAt;
    let index = closerToBeggining ? 0 : this.queue.length - 1;
    if (closerToBeggining) {
      while (index < this.queue.length) {
        if (this.queue[index].endsAt > target.endsAt) { break; }
        index++;
      }
    } else {
      while (index >= 0) {
        if (this.queue[index].endsAt <= target.endsAt) {
          index++;
          break;
        }
        index--;
      }
    }
    this.queue.splice(index, 0, target);
    if (item instanceof Array && item.length) { return this.addToQueue(item); }
    logger.info('[queue] adding item', item);

    const inOrder = this.queue.every((t, i, arr) => i + 2 >= arr.length ? true : +t.endsAt <= +arr[i + 1].endsAt);
    if (!inOrder) {
      throw new Error('queue not in order');
    }
    this.setEarliestItem();
  }

  public removeFromQueue(...items: TownQueue[]) {
    if (!items || !items.length) { return; }

    if (this.earliestItem && items.some((item) => this.earliestItem.id === item.id && item.constructor.name === this.earliestItem.constructor.name)) {
      this.earliestItem = null;
    }

    let i = 0;
    while (items.length && i < this.queue.length) {
      const removedItem = items.findIndex((item) => item.id === this.queue[i].id && item.constructor.name === this.queue[i].constructor.name);
      if (removedItem !== -1) {
        this.queue.splice(i, 1);
        items.splice(removedItem, 1);
        continue;
      }
      i++;
    }
    logger.info('[queue] removed items', i);

    // If removed item is earliest set new earliest item
    this.setEarliestItem();
  }

  public setEarliestItem() {
    // Exit if earliest item is on track
    if (this.inProgress || !this.queue.length || (this.earliestItem && this.earliestItem.endsAt <= this.queue[0].endsAt)) {
      return;
    }

    this.earliestItem = this.queue[0];
    logger.info('[queue] updating earliest item', this.earliestItem);
    clearTimeout(this.queueTimeout);
    this.queueTimeout = setTimeout(() => this.processItem(), +this.earliestItem.endsAt - Date.now());
  }

  public async processItem(attempt = 1) {
    this.inProgress = true;
    const targetTown = !(this.earliestItem instanceof Movement) ? (this.earliestItem as UnitQueue | BuildingQueue).townId : this.earliestItem.targetTownId;
    try {
      logger.info('[queue] processing item', this.earliestItem);
      const { town } = await Town.processTownQueues(targetTown, +this.earliestItem.endsAt);
      TownSocket.emitToTownRoom(town.id, town, 'town:update');

      this.inProgress = false;
      this.removeFromQueue(this.earliestItem);
    } catch (err) {
      if (attempt >= this.maxAttempts) {
        logger.error('Failed processing item', this.earliestItem, this.queue.slice(0, 3), err);
        throw new Error('Failed to process queue item too many times');
      }
      logger.error(`Errored while processing queue item, retrying #${attempt}`, err);
      return this.processItem(++attempt);
    }
  }
}

export const townQueue = new TownEventQueue();
