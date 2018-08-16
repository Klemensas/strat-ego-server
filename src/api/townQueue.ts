import { knexDb } from '../sqldb';
import { BuildingQueue } from './building/buildingQueue';
import { UnitQueue } from './unit/unitQueue';
import { Movement } from './town/movement';
import { Town, TownQueue } from './town/town';
import { TownSocket } from './town/townSocket';
import { logger } from '../logger';
import { getSortedBuildingQueues, getSortedUnitQueues, getSortedMovements } from './world/worldQueries';

export class TownEventQueue {
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
    const closerToBeggining = !this.queue.length ? true :
      Math.abs(this.queue[0].endsAt - target.endsAt) <= Math.abs(this.queue[this.queue.length - 1].endsAt - target.endsAt);
    let index = closerToBeggining ? 0 : this.queue.length - 1;
    if (closerToBeggining) {
      while (index < this.queue.length) {
        if (this.queue[index].endsAt > target.endsAt) { break; }
        index++;
      }
    } else {
      while (index > 0) {
        if (this.queue[index].endsAt < target.endsAt) { break; }
        index--;
      }
    }
    this.queue.splice(index, 0, target);
    if (item instanceof Array && item.length) { return this.addToQueue(item); }
    this.setEarliestItem();
  }

  public removeFromQueue(...items: TownQueue[]) {
    if (!items || !items.length) { return; }
    this.queue = this.queue.filter((item) => !items.find(({ id }) => item.id === id));
  }

  public setEarliestItem() {
    if (this.inProgress) { return; }
    // Exit if earliest item is on track
    if (!this.queue.length || (this.earliestItem && this.earliestItem.endsAt < this.queue[0].endsAt)) {
      return;
    }

    this.earliestItem = this.queue[0];
    clearTimeout(this.queueTimeout);
    this.queueTimeout = setTimeout(() => this.processItem(), +this.earliestItem.endsAt - Date.now());
  }

  public async processItem() {
    this.inProgress = true;
    const targetTown = !(this.earliestItem instanceof Movement) ? (this.earliestItem as UnitQueue | BuildingQueue).townId : this.earliestItem.targetTownId;
    try {
      const { town, processed } = await Town.processTownQueues(targetTown, +this.earliestItem.endsAt);
      TownSocket.emitToTownRoom(town.id, town, 'town:update');

      this.inProgress = false;
      this.removeFromQueue(this.earliestItem);
    } catch (err) {
      logger.error('Errored while processing queue item, retrying...', err);
      this.processItem();
    }
  }
}

export const townQueue = new TownEventQueue();
