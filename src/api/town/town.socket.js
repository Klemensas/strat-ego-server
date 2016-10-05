import { activeWorlds } from '../../components/worlds';
import { world } from '../../sqldb';
import { queue } from '../world/queue';

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
    // const world = activeWorlds.get('megapolis');
    // get data for target building
    const townWorld = activeWorlds.get('megapolis');
    const buildingData = townWorld.buildingData
      .find(building => building.name === data.building).data[level];

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
      .then(item => queue.queueItem(item));
    }
  }
  // TODO: real error here
  return Promise.reject('target not found');
}

function changeName(data) {
  // TODO: full handling
  if (!data.name || !data.town) {
    return;
  }
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
  getTown(this, data.town)
    .then(town => {
        // STUB
    })
    .catch(err => {
      console.log('SOCKET RECRUIT ERROR', err);
    });
}

export const joinTownRoom = socket => {
  if (socket.player && socket.player.Towns.length) {
    socket.player.Towns.forEach(town => socket.join(town._id));
  }
};

export const initializeTown = socket => {
  joinTownRoom(socket);

  socket.on('town:name', changeName);
  socket.on('town:build', build);
  socket.on('town:recruit', recruit);
  return socket;
};
