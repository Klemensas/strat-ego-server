import { world } from '../../sqldb';
import { socket } from '../../app';

const Town = world.Town;
const BuildingQueue = world.BuildingQueue;

class Queue {
  constructor() {
    this.items = {};

    BuildingQueue
      .destroy({ where: { TownId: null } })
      .then(() => BuildingQueue.findAll())
      .then(items => items.forEach(this.queueItem));
  }

  processItem(townId) {
    const queueItem = this.items[townId].nextItem;
    return Town.findOne({ where: { _id: townId } }, { include: { all: true } })
      .then(town => {
        const building = town.buildings[queueItem.building];
        building.level++;
        // Set queued to 0 if queue is empty for building
        if (building.queued === building.level) {
          building.queued = 0;
        }
        // trigger buildings change manully, because sequalize can't detect it
        town.changed('buildings', true);

        return world.sequelize.transaction(transaction => {
          return queueItem.destroy({ transaction })
            .then(() => town.save({ transaction }));
        })
        .then(() => this.updateQueue(townId, queueItem));
      })
      // TODO: test and handle concurrency
      .catch(error => console.log(`PROCESS ERROR: ${error}`));
  }

  updateQueue(id, item) {
    const townQueue = this.items[id];
    if (townQueue.nextItem === item) {
      townQueue.items.splice(0, 1);
      townQueue.nextItem = townQueue.items[0];
      if (townQueue.nextItem) {
        townQueue.timer = setTimeout(() => this.processItem(id), townQueue.nextItem.endsAt - Date.now());
        return;
      }
    }
    const position = townQueue.items.findIndex(q => q === item);
    townQueue.items.splice(position, 1);
  }

  queueItem(item) {
    const town = item.TownId;
    let townQueue = this.items[town];
    item.endsAt = new Date(item.endsAt).getTime();

    if (townQueue && townQueue.nextItem) {
      townQueue.items.push(item);
      townQueue.items.sort((a, b) => a.endsAt - b.endsAt);
      if (townQueue.nextItem === townQueue.items[0]) {
        return;
      }
      clearTimeout(townQueue.timer);
      townQueue.nextItem = townQueue.items[0];
    } else {
      this.items[town] = townQueue = {
        nextItem: item,
        items: [item],
      };
    }
    townQueue.timer = setTimeout(() => this.processItem(town), townQueue.nextItem.endsAt - Date.now());
  }
}
export const queue = new Queue();
