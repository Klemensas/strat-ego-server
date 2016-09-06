import { worldEvents } from './world.events';
import { activeWorlds } from '../../components/worlds';
import { worldCtrl } from './world.ctrl';

// Model events to emit
const events = ['save', 'remove'];

function createListener(event, socket) {
  return doc => {
    socket.emit(event, doc);
  };
}

function removeListener(event, listener) {
  return () => {
    worldEvents.player.removeListener(event, listener);
  };
}

function sendInitData(socket) {
  if (!socket.player) {
  console.log('watafak?', socket.player);
    return worldCtrl.joinWorld(socket.world, socket.username, socket.userId)
      .then(player => {
        socket.player = player;
        console.log('dis is da playa wtf', player);
        socket.emit('self', player);
      })
    .catch();
  }
  console.log('dis aother?', socket.player);
  socket.emit('self', socket.player);
}

export const register = (socket) => {
  if (!activeWorlds.has(socket.world)) {
    // No world, procceed to disconnect
    return;
  }
  sendInitData(socket);

  // Bind model events to socket events
  for (let i = 0, eventsLength = events.length; i < eventsLength; i++) {
    const event = events[i];
    const listener = createListener(`world:${event}`, socket);

    worldEvents.player.on(event, listener);
    socket.on('disconnect', removeListener(event, listener));
  }
};
