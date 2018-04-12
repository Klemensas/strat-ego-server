import { transaction, Transaction, lit, raw } from 'objection';
import { Coords } from 'strat-ego-common';

import { knexDb } from '../../sqldb';
import { Player } from './player';
import { Town } from '../town/town';
import { UserWorld } from '../user/userWorld';
import { TownSocket } from '../town/town.socket';
import { UserSocket } from '../../config/socket';
import { mapManager } from '../map/mapManager';
import { scoreTracker } from './playerScore';

export class PlayerSocket {
  static async onConnect(socket: UserSocket) {
    const player = await this.getOrCreatePlayer(socket);
    await this.processPlayerTowns(player);
    socket.userData = {
      ...socket.userData,
      playerId: player.id,
      playerName: player.name,
      townIds: player.towns.map(({ id }) => id),
      allianceName: player.alliance ? player.alliance.name : null,
      allianceId: player.allianceId,
      allianceRoleId: player.allianceRoleId,
      alliancePermissions: player.allianceRole ? player.allianceRole.permissions : null,
      updatedAt: player.updatedAt,
    };
    socket.join(`player.${player.id}`);
    socket.emit('player', player);

    socket.on('player:restart', () => this.restart(socket));
  }

  private static async getOrCreatePlayer(socket) {
    const player = await Player.getPlayer({ userId: socket.userData.userId });
    if (player) { return player; }

    try {
      await this.createPlayer(
        socket.userData.username,
        socket.userData.userId,
        socket.userData.worldName,
      );
      const createdPlayer = await Player.getPlayer({ userId: socket.userData.userId });
      mapManager.addPlayerTowns(createdPlayer);
      scoreTracker.addPlayer({
        id: createdPlayer.id,
        name: createdPlayer.name,
        score: createdPlayer.towns[0].score,
      })
      return createdPlayer;
    } catch (err) {
      socket.log('Cannot create player', err);
      throw err;
    }
  }

  private static async createPlayer(name: string, userId: number, worldName: string) {
    let trxWorld: Transaction;
    let trxMain: Transaction;
    try {
      trxMain = await transaction.start(knexDb.main);
      trxWorld = await transaction.start(knexDb.world);

      const location = await mapManager.chooseLocation(trxMain);
      const player: any = await Player.query(trxWorld).insertGraph({
        name,
        userId,
        towns: [{
          name: `${name}s Town`,
          location,
        }],
      } as any);
      await UserWorld.query(trxMain).insert({
        userId,
        worldName,
        playerId: player.id,
      });
      await trxMain.commit();
      await trxWorld.commit();

      return player;
    } catch (err) {
      await trxMain.rollback();
      await trxWorld.rollback();

      throw err;
    }
  }

  private static async processPlayerTowns(player: Player) {
    const playerTowns = await Promise.all(player.towns.map((town) => Town.processTownQueues(town)));
    player.towns = playerTowns.map(({ town, processed }) => town);
    return player;
  }

  private static async restart(socket: UserSocket) {
    socket.log(`player ${socket.userData.username} is restarting`);
    if (socket.userData.townIds.length) {
      socket.log('Can\'t restart with active towns');
      throw new Error('Can\'t restart with active towns');
    }
    let trxWorld: Transaction;
    let trxMain: Transaction;
    try {
      trxMain = await transaction.start(knexDb.main);
      trxWorld = await transaction.start(knexDb.world);

      const location = await mapManager.chooseLocation(trxMain);
      const town = await Town.query(trxWorld).insert({ location, name: `${socket.userData.playerName}s Town`, playerId: socket.userData.playerId });
      const player = await Player.getPlayer({ userId: socket.userData.playerId });

      await trxMain.commit();
      await trxWorld.commit();

      socket.userData = {
        ...socket.userData,
        townIds: player.towns.map(({ id }) => id),
      };
      TownSocket.joinTownRoom(socket);
      socket.emit('player', player);
    } catch (err) {
      await trxMain.rollback();
      await trxWorld.rollback();

      socket.log('Error while restarting');
      throw err;
    }
  }
}
