import { activeWorlds } from '../../components/worlds';
import { world } from '../../sqldb';

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
      return town.save()
        // create buildingQueue
        .then(updatedTown => updatedTown.createBuildingQueue({
          building: data.building,
          buildTime: buildingData.buildTime,
          endsAt: updatedTown.updatedAt + buildingData.buildTime * 1000,
          level,
        }))
        // reload town to fetch association and new values
        .then(() => town.reload({ include: [{ model: BuildingQueue }] }));
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
    .then(town => {
      targetTown = town;
      this.log('town saved');
      this.emit('town', town);
    })
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
    .then(town => {
      targetTown = town;
      this.emit('town', town);
    })
    .catch(error => {
      console.log('SOCKET ERROR ERROR', error);
    });
}


export const register = socket => {

  // for (let i = 0, eventsLength = events.length; i < eventsLength; i++) {
  //   const event = events[i];
  //   const listener = createListener(`world:${event}`, socket);

  //   worldEvents.player.on(event, listener);
  //   socket.on('disconnect', removeListener(event, listener));
  socket.on('town:name', changeName);
  socket.on('town:build', build);
  // }
};
