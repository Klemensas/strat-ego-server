import WorldData from '../../components/world';
import { Town, townIncludes } from './Town.model';
import { Player } from '../world/Player.model';
import { UnitQueue } from '../world/UnitQueue.model';
import { BuildingQueue } from '../world/BuildingQueue.model';
import { world } from '../../sqldb';
import Queue from '../world/queue';

function joinTownRoom(socket) {
  if (socket.player && socket.player.Towns.length) {
    socket.player.Towns.forEach((town) => socket.join(town._id));
    socket.log(`${socket.username} joined town rooms`);
  }
}

function getTown(client, town) {
  const targetTown = client.player.Towns.find((t) => town === t._id);
  if (targetTown) {
    return targetTown.reload({ include: townIncludes });
  }
  return Promise.reject('No town found');
}

function tryBuilding(town: Town, data) {
  const target = town.buildings[data.building];
  if (target) {
    // Select next level latest queued or the current level;
    const level = target.queued || target.level;
    const targetBuilding = WorldData.buildingMap[data.building];
    const buildingData = targetBuilding.data[level];

    if (!town.checkBuildingRequirements(targetBuilding.requirements)) {
      return Promise.reject('Requirements not met');
    }
    if (!buildingData) {
      return Promise.reject('Wrong building');
    }

    const time = Date.now();
    town = town.updateRes(time) ;
    town.resources.clay -= buildingData.costs.clay;
    town.resources.wood -= buildingData.costs.wood;
    town.resources.iron -= buildingData.costs.iron;
    target.queued = level + 1;
    // trigger buildings change manully, because sequalize can't detect it
    town.changed('buildings', true);

    return world.sequelize.transaction((transaction) => {
      return town.createBuildingQueue({
        building: data.building,
        buildTime: buildingData.buildTime,
        endsAt: time + buildingData.buildTime,
        level,
      }, { transaction })
        .then(() => town.save({ transaction }));
    });
  }
  // TODO: real error here
  return Promise.reject('target not found');
}

function tryRecruiting(town, data) {
  const time = Date.now();
  const unitData = WorldData.unitMap;
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
  return world.sequelize.transaction((transaction) => {
    return UnitQueue.bulkCreate(unitsToQueue, { transaction })
      .then(() => town.save({ transaction }));
  });
}

function trySending(town, data) {
  const unitData = WorldData.unitMap;
  const queueCreateTime = Date.now();
  let slowest = 0;

  if (data.target === town.location) {
    return Promise.reject('Can\'t attack your own town');
  }

  return Town.findOne({ where: { location: data.target } }).then((targetTown) => {
    const distance = Town.calculateDistance(town.location, targetTown.location);

    for (const unit of data.units) {
      if (!town.units.hasOwnProperty(unit[0])) {
        return Promise.reject('no such unit');
      }
      town.units[unit[0]].inside -= unit[1];
      town.units[unit[0]].outside += unit[1];

      slowest = Math.max(unitData[unit[0]].speed, slowest);
    }

    const movementTime = slowest * distance;
    town.changed('units', true);
    return world.sequelize.transaction((transaction) => {
      return town.createMovementOriginTown({
        units: data.units.reduce((result, [name, count]) => ({ ...result, [name]: count }), {}),
        type: data.type,
        endsAt: queueCreateTime + movementTime,
        MovementDestinationId: targetTown._id,
      }, { transaction })
        .then((item) => {
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
    .then((town) => {
      town.name = data.name;
      return town.save();
    })
    .then((town) => town.notify({ type: 'name' }))
    .catch((err) => this.log(err, 'SOCKET CHANGE NAME ERROR'));
}

function build(data) {
  // TODO: full handling
  if (!data.building || !data.town) {
    return;
  }
  this.log(`${this.username} attempting to build ${data.building} in ${data.town}`);
  getTown(this, data.town)
    .then((town) => tryBuilding(town, data))
    .then((town) => town.notify({ type: 'build' }))
    .catch((err) => this.log(err, 'SOCKET BUILD ERROR'));
}

function recruit(data) {
  if (!data.units || !data.town) {
    return;
  }
  this.log(`${this.username} attempting to recruit ${data.units} in ${data.town}`);
  getTown(this, data.town)
    .then((town) => tryRecruiting(town, data))
    .then((town) => town.notify({ type: 'recruit' }))
    .catch((err) => this.log(err, 'SOCKET RECRUIT ERROR'));
}

function update(data) {
  if (!data.town) {
    return;
  }
  // TODO: use town method instead of queue?
  this.log(`${this.username} attempting to update queue in ${data.town}`);
  return Town.processTownQueues(data.town)
    .then(({ town, processed }) => {
      const processedAttack = processed.some((queue) =>
        queue.constuctor.name === 'Movement' && queue.type === 'attack');
      if (!processedAttack) {
        return town.notify({ type: 'update' });
      }
      return Player.getPlayer(this.userId)
        .then((player) => this.emit('player', player));
    });
  // getTown(this, data.town)
  //   .then((town) => {
  //     const time = Date.now();
  //     town.BuildingQueues = town.BuildingQueues.filter((item) => time >= new Date(item.endsAt).getTime());
  //     town.UnitQueues = town.UnitQueues.filter((item) => time >= new Date(item.endsAt).getTime());
  //     town.MovementOriginTown = town.MovementOriginTown.filter((item) =>
  //       time >= new Date(item.endsAt).getTime());
  //     town.MovementDestinationTown = town.MovementDestinationTown.filter((item) =>
  //       time >= new Date(item.endsAt).getTime());
  //     return town;
  //   })
  //   .then((town) => Queue.processTown(town));
}

function troopMovement(data) {
  if (!data.town || !data.target || !data.type) {
    this.log('wrong data');
    return;
  }

  getTown(this, data.town)
    .then((town) => trySending(town, data))
    .then((town) => town.notify({ type: 'movement' }))
    .catch((err) => this.log(err, 'SOCKET MOVE ERROR'));
}

export default (socket) => {
  joinTownRoom(socket);
  socket.on('town:name', changeName);
  socket.on('town:build', build);
  socket.on('town:recruit', recruit);
  socket.on('town:update', update);
  socket.on('town:moveTroops', troopMovement);
  return socket;
};
