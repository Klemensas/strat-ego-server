import worldData from '../../components/worlds';
import { world } from '../../sqldb';
import { queue } from '../world/queue';

function joinTownRoom(socket) {
  if (socket.player && socket.player.Towns.length) {
    socket.player.Towns.forEach(town => socket.join(town._id));
    socket.log(`${socket.username} joined town rooms`);
  }
}

function getTown(client, town) {
  const targetTown = client.player.Towns.find(t => town === t._id);
  if (targetTown) {
    return targetTown.reload({ include: [{ all: true }] });
  }
  return Promise.reject('No town found');
}

function tryBuilding(town, data) {
  // check if building exists
  const target = town.buildings[data.building];
  if (target) {
    // Select next level latest queued or the current level;
    const level = target.queued || target.level;
    const buildingData = worldData.buildingMap[data.building].data[level];

    // check if building has target level
    // TODO: add and check requirements somewhere here
    if (buildingData) {
      town.resources.clay -= buildingData.costs.clay;
      town.resources.wood -= buildingData.costs.wood;
      town.resources.iron -= buildingData.costs.iron;
      target.queued = level + 1;
      // trigger buildings change manully, because sequalize can't detect it
      town.changed('buildings', true);
      // save town with updated values

      return world.sequelize.transaction(transaction => {
        let queuedItem = null;
        return town.createBuildingQueue({
          building: data.building,
          buildTime: buildingData.buildTime,
          endsAt: Date.now() + buildingData.buildTime * 1000,
          level,
        }, { transaction })
          .then(item => {
            queuedItem = item;
            return town.save({ transaction });
          })
          // Return queue item for further queuing
          .then(() => queuedItem);
      })
      .then(item => queue.queueItem(item, 'building'));
    }
  }
  // TODO: real error here
  return Promise.reject('target not found');
}

function tryRecruiting(town, data) {
  const unitData = worldData.unitMap;
  const unitsToQueue = [];
  const queueCreateTime = Date.now();
  const TownId = town._id;

  for (const unit of data.units) {
    if (!town.units.hasOwnProperty(unit.type)) {
      return Promise.reject('no such unit');
    }
    // TODO: add unit requirement checking
    town.resources.wood -= unitData[unit.type].costs.wood * unit.amount;
    town.resources.clay -= unitData[unit.type].costs.clay * unit.amount;
    town.resources.iron -= unitData[unit.type].costs.iron * unit.amount;
    town.units[unit.type].queued += unit.amount;

    const recruitTime = unit.amount * unitData[unit.type].recruitTime;
    const endsAt = queueCreateTime + recruitTime * 1000;
    unitsToQueue.push({
      unit: unit.type,
      amount: unit.amount,
      recruitTime,
      endsAt,
      TownId,
    });
  }

  town.changed('units', true);
  return world.sequelize.transaction(transaction => {
    let unitQueue;
    return world.UnitQueue.bulkCreate(unitsToQueue, { transaction, returning: true })
      .then(item => {
        unitQueue = item;
        return town.save({ transaction });
      })
      // Return queue item for further queuing
      .then(() => unitQueue);
  })
  .then(items => items.forEach(item => queue.queueItem(item, 'unit')));
}

function changeName(data) {
  // TODO: full handling
  if (!data.name || !data.town) {
    return;
  }
  this.log(`${this.username} attempting to change town name to ${data.name} in ${data.town}`);
  getTown(this, data.town)
    .then(town => {
      town.name = data.name;
      return town.save();
    })
    .catch(err => {
      console.log('SOCKET, CHANGE NAME FAIL', err);
    });
}

function build(data) {
  // TODO: full handling
  if (!data.building || !data.town) {
    return;
  }
  this.log(`${this.username} attempting to build ${data.building} in ${data.town}`);
  getTown(this, data.town)
    .then(town => tryBuilding(town, data))
    .catch(error => {
      console.log('SOCKET BUILD ERROR', error);
    });
}

function recruit(data) {
  if (!data.units || !data.town) {
    return;
  }
  this.log(`${this.username} attempting to recruit ${data.units} in ${data.town}`);
  getTown(this, data.town)
    .then(town => {
        // STUB
        tryRecruiting(town, data);
    })
    .catch(err => {
      console.log('SOCKET RECRUIT ERROR', err);
    });
}

export default socket => {
  joinTownRoom(socket);

  socket.on('town:name', changeName);
  socket.on('town:build', build);
  socket.on('town:recruit', recruit);
  return socket;
};
