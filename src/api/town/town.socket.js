
function changeName(data) {
  let targetTown = this.player.Towns.find(t => data.town === t._id);
  if (!targetTown || !data.name) {
    // handle missing town / no name error
    // this.disconnect();
    return;
  }
  targetTown.name = data.name;
  targetTown.fullSave()
    .then(town => {
      targetTown = town;
      this.log('town saved')
      this.emit('town', town);
    })
    .catch(err => {
      console.log('---save fail', err)
    });
}

export const register = socket => {

  // for (let i = 0, eventsLength = events.length; i < eventsLength; i++) {
  //   const event = events[i];
  //   const listener = createListener(`world:${event}`, socket);

  //   worldEvents.player.on(event, listener);
  //   socket.on('disconnect', removeListener(event, listener));
  socket.on('town:name', changeName);
  // }
};
