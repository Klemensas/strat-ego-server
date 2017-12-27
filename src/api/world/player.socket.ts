import { world } from '../../sqldb';
import MapManager from '../../components/map';
import { Town } from '../town/Town.model';
import { Player } from './Player.model';
import { UnitQueue } from './UnitQueue.model';
import { BuildingQueue } from './BuildingQueue.model';
import { Movement } from '../town/Movement.model';
import { Report } from '../report/Report.model';
import { UserWorld } from './UserWorld.model';
import { joinTownRoom } from '../town/town.socket';
import { Alliance } from './Alliance.model';

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
        PlayerId: newPlayer.id,
      })
      .then(() => newPlayer);
    });
}

function restart() {
  this.log(`player ${this.username} restarting`);
  return Player.getPlayer(this.userId)
    .then((player) => {
      if (player.Towns.length) {
        return Promise.reject('Can\'t restart.');
      }
      return MapManager.chooseLocation()
        .then((location) => player.createTown({ location, name: `${player.name}s Town` })
        .then(() => Player.getPlayer(this.userId)));
    })
    .then((player) => {
      this.player = player;
      joinTownRoom(this);
      this.emit('player', player);
    })
    .catch((err) => this.log(err, 'SOCKET RESTART ERROR'));
}

export default (socket) => Player.getPlayer(socket.userId)
  .then((player: Player) => {
    if (!player) {
      return createPlayer(socket).then(() => Player.getPlayer(socket.userId));
    }
    return player;
  })
  .then((player) => {
    return Promise.all(player.Towns.map((town) => Town.processTownQueues(town.id)))
      .then((processedTowns) => {
        player.Towns = processedTowns.map(({ town }) => town);
        return player;
      });
  })
  .then((player) => {
    socket.player = player;
    socket.join(`player.${player.id}`);
    socket.emit('player', player);

    socket.on('player:restart', restart);
    return socket;
  })
  .catch((err) => socket.log(err, 'SOCKET FATAL ERROR'));
