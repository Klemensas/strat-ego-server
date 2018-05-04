import { transaction, Transaction, lit, raw } from 'objection';
import { Coords } from 'strat-ego-common';

import { knexDb } from '../../sqldb';
import { Player } from './player';
import { Town } from '../town/town';
import { UserWorld } from '../user/userWorld';
import { TownSocket } from '../town/townSocket';
import { UserSocket } from '../../config/socket';
import { mapManager } from '../map/mapManager';
import { scoreTracker } from './playerScore';
import { getFullPlayer, createPlayer, createPlayerTown } from './playerQueries';

export class PlayerSocket {
  static async onConnect(socket: UserSocket) {
    const player = await this.getOrCreatePlayer(socket);
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
    const player = await getFullPlayer({ userId: socket.userData.userId });
    if (player) { return player; }

    try {
      await this.createPlayer(
        socket.userData.username,
        socket.userData.userId,
        socket.userData.worldName,
      );
      const createdPlayer = await getFullPlayer({ userId: socket.userData.userId });
      mapManager.addPlayerTowns(createdPlayer);
      scoreTracker.addPlayer({
        id: createdPlayer.id,
        name: createdPlayer.name,
        score: createdPlayer.towns[0].score,
      });
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
      const player: any = await createPlayer(name, location, userId, worldName, trxWorld, trxMain);
      await trxMain.commit();
      await trxWorld.commit();

      return player;
    } catch (err) {
      await trxMain.rollback();
      await trxWorld.rollback();

      throw err;
    }
  }

  // private static async processPlayerTowns(player: Player) {
  //   const playerTowns = await Promise.all(player.towns.map((town) => Town.processTownQueues(town)));
  //   player.towns = playerTowns.map(({ town, processed }) => town);
  //   return player;
  // }

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
      const player = await getFullPlayer({ userId: socket.userData.playerId }, trxWorld);
      await createPlayerTown(player, location, trxWorld);

      await trxMain.commit();
      await trxWorld.commit();

      mapManager.addPlayerTowns(player);
      scoreTracker.setScore(player.towns[0].score, player.id);
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
