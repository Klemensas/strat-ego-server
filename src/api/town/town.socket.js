import { activeWorlds } from '../../components/worlds';
import { world } from '../../sqldb';
import { queue } from '../world/queue';

const BuildingQueue = world.BuildingQueue;

function getTown(client, data) {
  const targetTown = client.player.Towns.find(t => data.town === t._id);
  return targetTown;
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
  let targetTown = getTown(this, data);
  if (!targetTown || !data.name) {
    // handle missing town / no name error
    // this.disconnect();
    return;
  }
  targetTown.name = data.name;
  targetTown.save()
    // .then()
    .catch(err => {
      console.log('---save fail', err);
    });
}

function build(data) {
  let targetTown = getTown(this, data);
  if (!targetTown) {
    // handle missing town / no name error
    // this.disconnect();
    return;
  }
  tryBuilding(targetTown, data)
    // .then(town => {
    //   console.log('town updated', town.BuildingQueue)
    //   targetTown = town;
    //   this.emit('town', town);
    // })
    .catch(error => {
      console.log('SOCKET ERROR ERROR', error);
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
  return socket;
};
