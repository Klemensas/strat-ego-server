import { world } from '../../sqldb';
import MapManager from '../../components/map';
import { Town } from '../town/Town.model';
import { Player } from './Player.model';
import { UnitQueue } from './UnitQueue.model';
import { BuildingQueue } from './BuildingQueue.model';
import { Movement } from '../town/Movement.model';
import { Report } from '../report/Report.model';
import { UserWorld } from './UserWorld.model';

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
    .then((newPlayer: Player) => {
      return UserWorld.create({
        UserId: socket.userId,
        World: socket.world,
        PlayerId: newPlayer._id,
      })
      .then(() => newPlayer);
    });
}

function getPlayer(socket) {
  return Player.findOne({
    where: { UserId: socket.userId },
    include: [{
      model: Town,
      as: 'Towns',
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
  });
}

export default (socket) => getPlayer(socket)
  .then((player: Player) => {
    if (!player) {
      return createPlayer(socket).then(() => getPlayer(socket));
    }
    return player;
  })
  .then((player) => {
    return Promise.all(player.Towns.map((town) => Town.processTownQueues(town._id)))
      .then((towns: Town[]) => {
        player.Towns = towns;
        return player;
      });
  })
  .then((player: Player) => {
    socket.player = player;
    socket.emit('player', player);
    return socket;
  });
