import { transaction, Transaction, lit, raw } from 'objection';
import { Coords, ProfileUpdate } from 'strat-ego-common';

import { knexDb } from '../../sqldb';
import { Player } from './player';
import { Town } from '../town/town';
import { UserWorld } from '../user/userWorld';
import { TownSocket } from '../town/townSocket';
import { UserSocket, ErrorMessage } from '../../config/socket';
import { mapManager } from '../map/mapManager';
import { scoreTracker } from './playerScore';
import { getFullPlayer, createPlayer, createPlayerTown, getPlayerProfile, getPlayer, updatePlayer } from './playerQueries';
import { isCloudinaryImage, cloudinaryDelete } from '../../cloudinary';

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
    socket.on('player:loadProfile', (id: number) => this.loadProfile(socket, id));
    socket.on('player:updateProfile', (payload: ProfileUpdate) => this.updateProfile(socket, payload));
    socket.on('player:removeAvatar', () => this.removeAvatar(socket));
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

      socket.handleError(err, 'rest', 'player:restartFail');
    }
  }

  static async loadProfile(socket: UserSocket, id: number) {
    try {
      const player = await getPlayerProfile({ id });
      if (!player) { throw new ErrorMessage('Wrong player'); }

      socket.emit('player:loadProfileSuccess', player);
    } catch (err) {
      socket.handleError(err, 'loadProfile', 'player:loadProfileFail');
    }
  }

  static async updateProfile(socket: UserSocket, payload: ProfileUpdate) {
    const trx = await transaction.start(knexDb.world);
    try {
      const player = await getPlayerProfile({ id: socket.userData.playerId }, trx);

      let avatarToDelete;
      const updatePayload: ProfileUpdate = {};
      if (!player || payload.avatarUrl) {
        if (!isCloudinaryImage(payload.avatarUrl)) { throw new ErrorMessage('Invalid avatar'); }

        updatePayload.avatarUrl = payload.avatarUrl;
        if (player.avatarUrl) { avatarToDelete = player.avatarUrl; }
      }
      if (payload.description) { updatePayload.description = payload.description; }

      await updatePlayer(player, updatePayload, trx);

      if (avatarToDelete) {
        await cloudinaryDelete(avatarToDelete);
      }
      await trx.commit();

      socket.emit('player:updateProfileSuccess', updatePayload);
    } catch (err) {
      await trx.rollback();
      socket.handleError(err, 'updateProfile', 'player:updateProfileFail');
    }
  }

  static async removeAvatar(socket: UserSocket) {
    const trx = await transaction.start(knexDb.world);
    try {
      const player = await getPlayerProfile({ id: socket.userData.playerId }, trx);
      if (!player || !player.avatarUrl) { throw new ErrorMessage('No avatar present'); }

      await cloudinaryDelete(player.avatarUrl);
      await updatePlayer(player, { avatarUrl: null }, trx);

      await trx.commit();

      socket.emit('alliance:removeAvatarSuccess', { avatarUrl: null });
    } catch (err) {
      await trx.rollback();
      socket.handleError(err, 'removeAvatar', 'player:removeAvatarFail');
    }
  }
}
