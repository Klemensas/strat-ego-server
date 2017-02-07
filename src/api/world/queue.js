import { Sequelize, world } from '../../sqldb';

const Town = world.Town;
const BuildingQueue = world.BuildingQueue;
const UnitQueue = world.UnitQueue;

class Queue {
  constructor() {
    this.queueTick = 30000;
  }

  init() {
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
      }, {
        model: UnitQueue,
        where: { endsAt: { $lte: time } },
        required: false
      }]
    })
    .then(towns => Promise.all(towns.map(town => this.processTown(town))))
    .then(() => setTimeout(() => this.processQueue(time + this.queueTick), this.queueTick))
    .catch(err => console.log('Queue process error', err));
  }

  // non static due to being called from class instance
  processTown(town) {
    const procdTown = town.processQueues();

    if (!procdTown.doneBuildings.length && !procdTown.doneUnits.length) {
      return town;
    }
    return world.sequelize.transaction(transaction =>
      BuildingQueue.destroy({
        where: { _id: { $in: procdTown.doneBuildings } },
        transaction
      })
      .then(() => UnitQueue.destroy({
        where: { _id: { $in: procdTown.doneUnits } },
        transaction
      }))
      .then(() => procdTown.save({ transaction }))
    )
    .catch(err => console.log('town process transaction error', err));
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

const queue = new Queue();

export default queue;
