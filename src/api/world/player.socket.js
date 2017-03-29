import { world, main } from '../../sqldb';
import * as map from '../../components/map';

const UserWorlds = main.UserWorlds;
const Player = world.Player;
const Town = world.Town;
const Movement = world.Movement;

function createPlayer(socket) {
  socket.log(`creating player for ${socket.username}, on ${socket.world}`);
  return map.chooseLocation(socket.world)
    .then(location => Player.create({
      name: socket.username,
      UserId: socket.userId,
      Towns: [{
        name: `${socket.username}s Town`,
        location,
      }],
    }, {
      include: [{ all: true }],
    }))
    .then(newPlayer => {
      return UserWorlds.create({
        UserId: socket.userId,
        World: socket.world,
        PlayerId: newPlayer._id,
      })
      .then(() => newPlayer);
    });
}

export default socket => Player.findOne({
  where: { UserId: socket.userId },
  include: [{
    model: Town,
    include: [{
      all: true
    }, {
      model: Movement,
      as: 'MovementDestinationTown',
      attributes: { exclude: ['createdAt', 'updatedAt', 'units'] }
    }]
  }]
})
  .then(player => {
    if (!player) {
      return createPlayer(socket);
    }
    // TODO: process queues here before sending?
    // player.Towns.map(town => {
    //   console.log('t', town.dataValues, typeof town.processQueues);
    // });
    return player;
  })
  // .then(createPlayer(socket))
  .then(player => {
    socket.player = player;
    socket.emit('player', player);
    return socket;
  });
