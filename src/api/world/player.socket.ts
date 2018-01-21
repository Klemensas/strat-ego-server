import * as Bluebird from 'bluebird';
import MapManager from '../../components/map';
import { Town } from '../town/town.model';
import { Player } from './player.model';
import { UserWorld } from './userWorld.model';
import { TownSocket } from '../town/town.socket';
import { UserSocket } from 'config/socket';

export class PlayerSocket {
  static onConnect(socket: UserSocket): Bluebird<void> {
    return this.getOrCreatePlayer(
      socket.userData.username,
      socket.userData.userId,
      socket.userData.worldName,
    )
      .then((player) => this.processPlayerTowns(player))
      .then((player) => {
        socket.userData = {
          ...socket.userData,
          playerId: player.id,
          playername: player.name,
          townIds: player.Towns.map(({ id }) => id),
          AllianceId: player.AllianceId,
          AllianceRoleId: player.AllianceRoleId,
          AlliancePermissions: player.AllianceRole ? player.AllianceRole.permissions : null,
          updatedAt: player.updatedAt,
        };
        socket.join(`player.${player.id}`);
        socket.emit('player', player);

        socket.on('player:restart', () => this.restart(socket));
      });
  }

  private static getOrCreatePlayer(username: string, userId: number, worldName: string): Bluebird<Player> {
    return Player.getPlayer({ id: userId }).then((player: Player) => {
      if (!player) {
        return this.createPlayer(username, userId, worldName).then(() => Player.getPlayer({ UserId: userId }));
      }
      return player;
    });
  }

  private static createPlayer(username: string, userId: number, worldName: string): Bluebird<Player> {
    return MapManager.chooseLocation()
      .then((location) => Player.create({
        name: username,
        UserId: userId,
        Towns: [{
          name: `${username}s Town`,
          location,
        }],
      }, {
        include: [{ all: true }],
      }))
      .then((newPlayer: Player) => {
        return UserWorld.create({
          UserId: userId,
          World: worldName,
          PlayerId: newPlayer.id,
        })
        .then(() => newPlayer);
      });
  }

  private static processPlayerTowns(player: Player): Promise<Player> {
    return Promise.all(player.Towns.map((town) => Town.processTownQueues(town.id)))
      .then((processedTowns) => {
        player.Towns = processedTowns.map(({ town }) => town);
        return player;
      });
  }

  private static restart(socket: UserSocket) {
    socket.log(`player ${socket.userData.username} restarting`);
    if (socket.userData.townIds.length) {
      return Promise.reject('Can\'t restart.');
    }
    return MapManager.chooseLocation()
      .then((location) => Town.create({ location, name: `${socket.userData.playername}s Town` }))
      .then(() => Player.getPlayer({ UserId: socket.userData.userId }))
      .then((player) => {
        socket.userData = {
          ...socket.userData,
          townIds: player.Towns.map(({ id }) => id),
        };
        TownSocket.joinTownRoom(socket);

        socket.emit('player', player);
      });
  }
}
