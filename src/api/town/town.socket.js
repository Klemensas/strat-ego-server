import worldData from '../../components/worlds';
import { world } from '../../sqldb';
import Queue from '../world/queue';

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
  const target = town.buildings[data.building];
  if (target) {
    // Select next level latest queued or the current level;
    const level = target.queued || target.level;
    const targetBuilding = worldData.buildingMap[data.building];
    const buildingData = targetBuilding.data[level];

    if (!town.checkBuildingRequirements(targetBuilding.requirements)) {
      return Promise.reject('Requirements not met');
    }
    if (!buildingData) {
      return Promise.reject('Wrong building');
    }

    town.resources.clay -= buildingData.costs.clay;
    town.resources.wood -= buildingData.costs.wood;
    town.resources.iron -= buildingData.costs.iron;
    target.queued = level + 1;
    // trigger buildings change manully, because sequalize can't detect it
    town.changed('buildings', true);

    return world.sequelize.transaction(transaction => {
      return town.createBuildingQueue({
        building: data.building,
        buildTime: buildingData.buildTime,
        endsAt: Date.now() + buildingData.buildTime,
        level,
      }, { transaction })
        .then(() => town.save({ transaction }));
    });
  }
  // TODO: real error here
  return Promise.reject('target not found');
}

function tryRecruiting(town, data) {
  const unitData = worldData.unitMap;
  const unitsToQueue = [];
  const queueCreateTime = new Date();
  const TownId = town._id;
  const availablePopulation = town.getAvailablePopulation();
  const recruitmentModifier = town.getRecruitmentModifier();
  let usedPop = 0;

  for (const unit of data.units) {
    const targetUnit = unitData[unit.type];
    if (!town.units.hasOwnProperty(unit.type) || +unit.amount <= 0) {
      return Promise.reject('no such unit');
    }
    if (!town.checkBuildingRequirements(targetUnit.requirements)) {
      return Promise.reject('requirements not met');
    }
    usedPop += unit.amount;
    town.resources.wood -= targetUnit.costs.wood * unit.amount;
    town.resources.clay -= targetUnit.costs.clay * unit.amount;
    town.resources.iron -= targetUnit.costs.iron * unit.amount;
    town.units[unit.type].queued += unit.amount;

    const lastQueue = town.getLastQueue('UnitQueues');
    const startTime = lastQueue ? lastQueue.endsAt : queueCreateTime;
    const recruitTime = unit.amount * targetUnit.recruitTime * recruitmentModifier;
    const endsAt = startTime.getTime() + recruitTime;
    unitsToQueue.push({
      unit: unit.type,
      amount: unit.amount,
      recruitTime,
      endsAt,
      TownId,
    });
  }

  if (usedPop > availablePopulation) {
      return Promise.reject('Population limit exceeded');
  }

  town.changed('units', true);
  return world.sequelize.transaction(transaction => {
    return world.UnitQueue.bulkCreate(unitsToQueue, { transaction })
      .then(() => town.save({ transaction }));
  });
}

function trySending(town, data) {
  const unitData = worldData.unitMap;
  const dataUnits = Object.entries(data.units);
  const queueCreateTime = Date.now();
  let slowest = 0;

  if (data.target === town._id) {
    return Promise.reject('Can\'t attack your own town');
  }

  return world.Town.findById(data.target).then(targetTown => {
    const distance = world.Town.calculateDistance(town.location, targetTown.location);

    for (const unit of dataUnits) {
      if (!town.units.hasOwnProperty(unit[0])) {
        return Promise.reject('no such unit');
      }
      town.units[unit[0]].inside -= unit[1];
      town.units[unit[0]].outside += unit[1];

      slowest = Math.max(unitData[unit[0]].speed, slowest);
    }

    const movementTime = slowest * distance;
    town.changed('units', true);
    return world.sequelize.transaction(transaction => {
      return town.createMovementOriginTown({
        units: data.units,
        type: data.type,
        endsAt: queueCreateTime + movementTime,
        MovementDestinationId: data.target
      }, { transaction })
        .then(item => {
          return town.save({ transaction });
        });
    });
  });


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
    .then(town => town.notify({ type: 'name' }))
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
    .then(town => town.notify({ type: 'build' }))
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
    .then(town => tryRecruiting(town, data))
    .then(town => town.notify({ type: 'recruit' }))
    .catch(err => {
      console.log('SOCKET RECRUIT ERROR', err);
    });
}

function update(data) {
  if (!data.town) {
    return;
  }
  // TODO: use town method instead of queue?
  this.log(`${this.username} attempting to update queue in ${data.town}`);
  getTown(this, data.town)
    .then(town => {
      console.log('updatin town', town.dataValues);
      const time = Date.now();
      town.BuildingQueues = town.BuildingQueues.filter(item => time >= new Date(item.endsAt).getTime());
      town.UnitQueues = town.UnitQueues.filter(item => time >= new Date(item.endsAt).getTime());
      town.MovementOriginTown = town.MovementOriginTown.filter(item => time >= new Date(item.endsAt).getTime());
      town.MovementDestinationTown = town.MovementDestinationTown.filter(item => time >= new Date(item.endsAt).getTime());
      return town;
    })
    .then(town => Queue.processTown(town));
}

function troopMovement(data) {
  if (!data.town || !data.target || !data.type) {
    this.log('wrong data');
    return;
  }

  getTown(this, data.town)
    .then(town => trySending(town, data))
    .then(town => town.notify({ type: 'movement' }))
    .catch(error => console.log('SOCKET MOVE ERROR', error));
}

export default socket => {
  joinTownRoom(socket);

  socket.on('town:name', changeName);
  socket.on('town:build', build);
  socket.on('town:recruit', recruit);
  socket.on('town:update', update);
  socket.on('town:moveTroops', troopMovement);
  return socket;
};
// 