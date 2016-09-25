import { world } from '../../sqldb';
import { socket } from '../../app';

const Town = world.Town;
const BuildingQueue = world.BuildingQueue;

class Queue {
  processItem(item) {
    return Town.findOne({ where: { _id: item.TownId } }, { include: { all: true } })
      .then(town => {
        const building = town.buildings[item.building];
        building.level++;
        // Set queued to 0 if queue is empty for building
        if (building.queued === building.level) {
          building.queued = 0;
        }
        return world.sequelize.transaction(transaction => {
          return town.removeBuildingQueue(item, { transaction })
            .then(() => town.save({ transaction }));
        })
        // .then(item => queue.queueItem(item));
      })
      .catch(error => console.log(`PROCESS ERROR: ${error}`));
  }

  queueItem(item) {
    const timeLeft = new Date(item.endsAt) - Date.now();
    setTimeout(this.processItem, timeLeft, item);
  }
}
export const queue = new Queue();


// initialization
BuildingQueue
  .destroy({ where: { TownId: null } })
  .then(() => BuildingQueue.findAll())
  .then(items => items.forEach(queue.queueItem));
