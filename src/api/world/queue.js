import { Sequelize, world } from '../../sqldb';
import { Town } from '../town/Town.model';
import { Movement } from '../town/Movement.model';
import { BuildingQueue } from './BuildingQueue.model';
import { UnitQueue } from './UnitQueue.model';

class Queue {
  constructor() {
    this.queueTick = 30000;
  }

  init() {
    Promise.all([
      BuildingQueue.destroy({ where: { TownId: null } }),
      UnitQueue.destroy({ where: { TownId: null } })
    ])
    .catch(() => this.processQueue());
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
    .catch(err => console.log('Queue process error', err))
    .then(() => setTimeout(() => this.processQueue(time.getTime() + this.queueTick), this.queueTick));
  }

  processTown(town) {
    return town.processQueues().then(procdTown => {
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
    });
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
