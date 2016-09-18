function getTown(client, data) {
  const targetTown = client.player.Towns.find(t => data.town === t._id);
  return targetTown;
}

function tryBuilding(town, data) {
  // check if building exists
  if (town.buildings[data.building]) {
    console.log('ok building exists');
  }
}

function changeName(data) {
  let targetTown = getTown(this, data);
  if (!targetTown || !data.name) {
    // handle missing town / no name error
    // this.disconnect();
    return;
  }
  targetTown.name = data.name;
  targetTown.fullSave()
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
  tryBuilding(targetTown, data);
  // targetTown.buildings[data.building]
  // targetTown.fullSave()
  // targetTown.buildings[]
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
