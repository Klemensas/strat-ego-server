import { Sequelize, world } from '../../sqldb';

const Town = world.Town;
const BuildingQueue = world.BuildingQueue;
const UnitQueue = world.UnitQueue;

class Queue {
  constructor() {
    this.items = [];
    const queueTypes = ['building', 'unit'];

    console.time('queue type 3');
    Promise.all([
      BuildingQueue.destroy({ where: { TownId: null } }),
      UnitQueue.destroy({ where: { TownId: null } })
    ])
      // .then(items => Promise.all(items.map(item => item.findAll())))
      // .then(queues => {
      //   queues.forEach((activeQueue, i) => {
      //     activeQueue.forEach(item => this.queueItem(item, queueTypes[i]));
      //   });
      // })
      .then(() => this.processQueue())
      .then(() => console.timeEnd('queue type 3'))
      .then(() => BuildingQueue.findAll())
      .then(items => console.log('queue items', items.length, items))
      .catch(err => console.log('process erorr'));
  }

  processQueue() {
    const time = Date.now();
      return Town.findAll({
        include: [{
          model: BuildingQueue,
          where: { endsAt: { $lte: time } }
        }]
        // logging: (d, ...t) => console.log('queue log', d, t)
      })
      .then(towns => {
        return Promise.all(towns.map(town => this.processTown(town)));
      })
    // })
    .catch(err => { console.log('woop wopp', err); });
    setTimeout(() => this.processQueue(), 10000);
  }

  processTown(town) {
    town = this.processBuildings(town);

    return world.sequelize.transaction(transaction => {
      return BuildingQueue.destroy({
        where: { _id: { $in: town.processedBuildings } },
        benchmark: true,
        // logging: (...t) => console.log(t),
        transaction
      })
        .then(() => {
          return town.save({ transaction })
        })  
      // return town.removeBuildingQueues(town.BuildingQueues, { transaction, benchmark: true, logging: (...t) => console.log('done', t) })
      // .then((...res) => console.log('this is da res', res))
    })
    .catch(err => console.log('transaction error', err));
  }

  processBuildings(town) {
    town.processedBuildings = [];
    town.BuildingQueues.forEach(queue => {
      const building = town.buildings['barracks'];
      building.level++;
      if (building.queued === building.level) {
        building.queued = 0;
      }
      town.processedBuildings.push(queue._id);
    });
    town.changed('buildings', true);
    return town;
  }

  processItem(townId) {
    const townQueue = this.items.get(townId);
    const queueItem = townQueue.items.find(item => item.endsAt === this.nextEvent);
    const queueAction = queueItem.type === 'building' ? Queue.processBuilding : Queue.processUnit;
    return Town.findOne({ where: { _id: townId } }, { include: { all: true } })
      .then(town => queueAction(town, queueItem))
      .then(town =>
        world.sequelize.transaction(transaction =>
          queueItem.destroy({ transaction })
            .then(() => town.save({ transaction }))
        )
      )
      .then(() => this.updateQueue(townId, queueItem))
      .catch(error => console.log(`Processing error - ${error}, ${queueItem._id} - ${queueItem.type}`));
  }

  updateQueue(townId, target) {
    const townQueue = this.items.get(townId);
    const itemIndex = townQueue.findIndex(item => item === target);
    if (itemIndex !== -1) {
      townQueue.items.splice(itemIndex, 1);
      townQueue.next = townQueue.items.reduce((soonest, item) => (item.endsAt > soonest ? soonest : item.endsAt), Infinity);
      this.items.set(townId, townQueue);
    }
    let soonest = Infinity;
    let targetTown;
    this.items.forEach((item, key) => {
      if (soonest > item.soonest) {
        soonest = item.soonest;
        targetTown = key;
      }
    });
    this.timer = setTimeout(() => this.processItem(targetTown), soonest - Date.now());
  }

  static processBuilding(town, item) {
    const building = town.buildings[item.building];
    building.level++;
    // Set queued to 0 if queue is empty for building
    if (building.queued === building.level) {
      building.queued = 0;
    }
    // trigger buildings change manully, because sequalize can't detect it
    town.changed('buildings', true);
    return town;
  }

  static processUnit(town, item) {
    const unit = town.units[item.unit];
    unit.amount += item.amount;
    unit.queued -= item.amount;
    // trigger units change manully, because sequalize can't detect it
    town.changed('units', true);
    return town;
  }
}

export default Queue;
