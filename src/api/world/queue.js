import { Sequelize, world } from '../../sqldb';

const Town = world.Town;
const BuildingQueue = world.BuildingQueue;
const UnitQueue = world.UnitQueue;
const Movement = world.Movement;

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
    const time = new Date();
    if (targetTime) {
      console.log(`Queue delay is ${time - targetTime}`);
    }

    return Town.findAll({
      where: {
        $or: [
          { '$BuildingQueues.endsAt$': { $lte: time } },
          { '$UnitQueues.endsAt$': { $lte: time } },
          { '$MovementDestinationTown.endsAt$': { $lte: time } },
          { '$MovementOriginTown.endsAt$': { $lte: time } }
        ]
      },
      include: [{
        model: BuildingQueue,
      }, {
        model: UnitQueue,
      }, {
        model: Movement,
        as: 'MovementOriginTown',
      }, {
        model: Movement,
        as: 'MovementDestinationTown',
      }]
    })
    .then(towns => Promise.all(towns.map(town => this.processTown(town))))
    .then(() => setTimeout(() => this.processQueue(time.getTime() + this.queueTick), this.queueTick))
    .catch(err => console.log('Queue process error', err));
  }

  // non static due to being called from class instance
  processTown(town) {
    console.log('town to process'/*, town.dataValues*/);
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
    .then(updatedTown => updatedTown.notify({ type: 'update' }))
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
