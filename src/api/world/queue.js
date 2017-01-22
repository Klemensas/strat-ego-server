import { Sequelize, world } from '../../sqldb';

const Town = world.Town;
const BuildingQueue = world.BuildingQueue;
const UnitQueue = world.UnitQueue;

class Queue {
  constructor() {
    this.queueTick = 30000;
    this.items = [];
    const queueTypes = ['building', 'unit'];

    Promise.all([
      BuildingQueue.destroy({ where: { TownId: null } }),
      UnitQueue.destroy({ where: { TownId: null } })
    ])
    .then(() => this.processQueue());
  }

  processQueue(targetTime) {
    const time = Date.now();
    if (targetTime) {
      console.log(`Queue delay is ${time - targetTime}`);
    }
    return Town.findAll({
      include: [{
        model: BuildingQueue,
        where: { endsAt: { $lte: time } }
      }]
    })
    .then(towns => Promise.all(towns.map(town => this.processTown(town))))
    .then(() => setTimeout(() => this.processQueue(time + this.queueTick), this.queueTick))
    .catch(err => console.log('Queue process error', err));
  }

  processTown(town) {
    const procdTown = this.processBuildings(town);

    return world.sequelize.transaction(transaction =>
      BuildingQueue.destroy({
        where: { _id: { $in: procdTown.processedBuildings } },
        transaction
      })
      .then(() => procdTown.save({ transaction }))
    )
    .catch(err => console.log('transaction error', err));
  }

  static processBuildings(town) {
    town.processedBuildings = [];
    town.BuildingQueues.forEach(queue => {
      const building = town.buildings[queue.building];
      building.level++;
      if (building.queued === building.level) {
        building.queued = 0;
      }
      town.processedBuildings.push(queue._id);
    });
    // trigger buildings change manully, because sequalize can't detect it
    town.changed('buildings', true);
    return town;
  }

//   static processUnit(town, item) {
//     const unit = town.units[item.unit];
//     unit.amount += item.amount;
//     unit.queued -= item.amount;
//     // trigger units change manully, because sequalize can't detect it
//     town.changed('units', true);
//     return town;
//   }
}

export default Queue;
