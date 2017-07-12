import { world, main } from '../../sqldb';
import MapManager from '../../components/map';

const UserWorlds = main.UserWorlds;
const Player = world.Player;
const Town = world.Town;
const Movement = world.Movement;
const Report = world.Report;

function createPlayer(socket) {
  socket.log(`creating player for ${socket.username}, on ${socket.world}`);
  return MapManager.chooseLocation()
    .then((location) => Player.create({
      name: socket.username,
      UserId: socket.userId,
      Towns: [{
        name: `${socket.username}s Town`,
        location,
      }],
    }, {
      include: [{ all: true }],
    }))
    .then((newPlayer) => {
      return UserWorlds.create({
        UserId: socket.userId,
        World: socket.world,
        PlayerId: newPlayer._id,
      })
      .then(() => newPlayer);
    });
}

export default (socket) => Player.findOne({
  where: { UserId: socket.userId },
  include: [{
    model: Town,
    include: [{
      all: true,
    }, {
      model: Movement,
      as: 'MovementDestinationTown',
      attributes: { exclude: ['createdAt', 'updatedAt', 'units'] },
      include: [{
        model: Town,
        as: 'MovementOriginTown',
        attributes: ['_id', 'name', 'location'],
      }, {
        model: Town,
        as: 'MovementDestinationTown',
        attributes: ['_id', 'name', 'location'],
      }],
    }, {
      model: Movement,
      as: 'MovementOriginTown',
      include: [{
        model: Town,
        as: 'MovementOriginTown',
        attributes: ['_id', 'name', 'location'],
      }, {
        model: Town,
        as: 'MovementDestinationTown',
        attributes: ['_id', 'name', 'location'],
      }],
    }],
  }, {
    model: Report,
    as: 'ReportDestinationPlayer',
    include: [{
      model: Town,
      as: 'ReportOriginTown',
      attributes: ['_id', 'name', 'location'],
    }, {
      model: Town,
      as: 'ReportDestinationTown',
      attributes: ['_id', 'name', 'location'],
    }],
  }, {
    model: Report,
    as: 'ReportOriginPlayer',
    include: [{
      model: Town,
      as: 'ReportOriginTown',
      attributes: ['_id', 'name', 'location'],
    }, {
      model: Town,
      as: 'ReportDestinationTown',
      attributes: ['_id', 'name', 'location'],
    }],
  }],
})
  .then((player) => {
    if (!player) {
      return createPlayer(socket);
    }
    console.log('should process town data before sending');
    // TODO: process queues here before sending?
    // player.Towns.map(town => {
    //   console.log('t', town.dataValues, typeof town.processQueues);
    // });
    return player;
  })
  // .then(createPlayer(socket))
  .then((player) => {
    socket.player = player;
    socket.emit('player', player);
    return socket;
  });
