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
      return town.save();
    })
    .then(town => {
      redisClient.get(town._id, (error, id) => {

        if (error) { console.log(`REDIS GEt ERROR ${error}`); return; }
        // If there is a connected socket
        if (id) {
          socket.to(id).emit('town', town);
        }
      });
      return town.removeBuildingQueue(item);
    });
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
