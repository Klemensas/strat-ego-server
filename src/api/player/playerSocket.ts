import { transaction, Transaction } from 'objection';
import { ProfileUpdate } from 'strat-ego-common';

import { knexDb } from '../../sqldb';
import { TownSocket } from '../town/townSocket';
import { UserSocket, ErrorMessage, io } from '../../config/socket';
import { getFullPlayer, createPlayer, createPlayerTown, getPlayerProfile, getPlayer, updatePlayer, progressTutorial } from './playerQueries';
import { isCloudinaryImage, cloudinaryDelete } from '../../cloudinary';
import { worldData } from '../world/worldData';
import { ProfileService } from '../profile/profileService';
import { Player } from './player';

export class PlayerSocket {
  static async onConnect(socket: UserSocket) {
    socket.on('player:restart', () => this.restart(socket));
    socket.on('player:updateProfile', (payload: ProfileUpdate) => this.updateProfile(socket, payload));
    socket.on('player:removeAvatar', () => this.removeAvatar(socket));
    socket.on('player:progressTutorial', () => this.progressTutorial(socket));

    const player = await this.getOrCreatePlayer(socket);
    socket.userData = {
      ...socket.userData,
      playerId: player.id,
      playerName: player.name,
      allianceId: player.allianceId,
      allianceRoleId: player.allianceRoleId,
    };
    socket.join(`player.${player.id}`);
    return player;

    // socket.userData = {
    //   ...socket.userData,
    //   playerId: player.id,
    //   playerName: player.name,
    //   townIds: player.towns.map(({ id }) => id),
    //   allianceName: player.alliance ? player.alliance.name : null,
    //   allianceId: player.allianceId,
    //   allianceRoleId: player.allianceRoleId,
    //   alliancePermissions: player.allianceRole ? player.allianceRole.permissions : null,
    //   updatedAt: player.updatedAt,
    // };
    // socket.emit('player', player);
  }

  static emitToPlayer(playerId: number, payload: any, topic: string = 'player') {
    io.sockets.in(`player.${playerId}`).emit(topic, payload);
  }

  static async getOrCreatePlayer(socket): Promise<Player> {
    const player = await getPlayer({ userId: socket.userData.userId });
    if (player) { return player; }

    try {
      await this.createPlayer(
        socket.userData.username,
        socket.userData.userId,
        socket.userData.worldName,
      );
      return this.getOrCreatePlayer(socket);
    } catch (err) {
      socket.log('Couldn\'t create player', err);
      throw err;
    }
  }

  static async createPlayer(name: string, userId: number, worldName: string) {
    let trxWorld: Transaction;
    let trxMain: Transaction;
    try {
      trxMain = await transaction.start(knexDb.main);
      trxWorld = await transaction.start(knexDb.world);

      const location = await worldData.mapManager.chooseLocation(trxMain);
      const player = await createPlayer(name, location, userId, worldName, trxWorld, trxMain);
      const playerTown = player.towns[0];
      await trxMain.commit();
      await trxWorld.commit();

      ProfileService.addPlayerProfile({
        id: player.id,
        name: player.name,
        towns: [{ id: playerTown.id }],
        score: playerTown.score,
        allianceId: null,
        description: null,
        avatarUrl: null,
        createdAt: player.createdAt,
      }, {
        id: playerTown.id,
        name: playerTown.name,
        location: playerTown.location,
        score: playerTown.score,
        playerId: player.id,
        createdAt: playerTown.createdAt,
      });

      return player;
    } catch (err) {
      await trxMain.rollback();
      await trxWorld.rollback();

      throw err;
    }
  }

  // static async processPlayerTowns(player: Player) {
  //   const playerTowns = await Promise.all(player.towns.map((town) => Town.processTownQueues(town)));
  //   player.towns = playerTowns.map(({ town, processed }) => town);
  //   return player;
  // }

  static async restart(socket: UserSocket) {
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

      const location = await worldData.mapManager.chooseLocation(trxMain);
      // TODO: refactor?
      const player = await getFullPlayer({ userId: socket.userData.playerId }, trxWorld);
      await createPlayerTown(player, location, trxWorld);
      const playerTown = player.towns[0];

      await trxMain.commit();
      await trxWorld.commit();

      socket.userData = {
        ...socket.userData,
        townIds: player.towns.map(({ id }) => id),
      };
      TownSocket.joinTownRoom(socket);
      ProfileService.updateTownProfile(playerTown.id, {
        id: playerTown.id,
        name: playerTown.name,
        location: playerTown.location,
        score: playerTown.score,
        playerId: playerTown.id,
        createdAt: playerTown.createdAt,
      });

      socket.emit('player', player);
    } catch (err) {
      await trxMain.rollback();
      await trxWorld.rollback();

      socket.handleError(err, 'rest', 'player:restartFail');
    }
  }

  static async updateProfile(socket: UserSocket, payload: ProfileUpdate) {
    const trx = await transaction.start(knexDb.world);
    try {
      const player = await getPlayer({ id: socket.userData.playerId }, trx);

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
      ProfileService.updatePlayerProfile(player.id, updatePayload);

      socket.emit('player:updateProfileSuccess', updatePayload);
    } catch (err) {
      await trx.rollback();
      socket.handleError(err, 'updateProfile', 'player:updateProfileFail');
    }
  }

  static async removeAvatar(socket: UserSocket) {
    const trx = await transaction.start(knexDb.world);
    try {
      const playerDict = await getPlayerProfile({ id: socket.userData.playerId }, trx);
      const player = playerDict && playerDict[socket.userData.playerId];
      if (!player || !player.avatarUrl) { throw new ErrorMessage('No avatar present'); }

      await cloudinaryDelete(player.avatarUrl);
      await updatePlayer(player, { avatarUrl: null }, trx);

      await trx.commit();
      ProfileService.updatePlayerProfile(player.id, { avatarUrl: null });

      socket.emit('player:removeAvatarSuccess', { avatarUrl: null });
    } catch (err) {
      await trx.rollback();
      socket.handleError(err, 'removeAvatar', 'player:removeAvatarFail');
    }
  }

  static async progressTutorial(socket: UserSocket) {
    try {
      await progressTutorial(socket.userData.playerId);

      socket.emit('player:progressTutorialSuccess');
    } catch (err) {
      socket.handleError(err, 'progressTutorial', 'player:progressTutorialFail');
    }
  }
}
