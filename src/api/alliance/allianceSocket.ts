import {
  PlayerRolePayload,
  EventType,
  EventStatus,
  AlliancePermissions,
  WarDeclarationPayload,
  Profile,
  DiplomacyType,
  DiplomacyStatus,
  diplomacyTypeToEventStatus,
  diplomacyTypeName,
  MessagePayload,
  RoleUpdatePayload,
} from 'strat-ego-common';

import { knexDb } from '../../sqldb';
import { io, UserSocket, AuthenticatedSocket, ErrorMessage } from '../../config/socket';
import { Alliance } from './alliance';
import { transaction } from 'objection';
import { setAlliancePermissions, AllianceRole } from './allianceRole';
import { AllianceEvent } from './allianceEvent';
import { Player } from '../player/player';
import { mapManager } from '../map/mapManager';
import { AllianceDiplomacy } from './allianceDiplomacy';
import { AllianceMessage } from './allianceMessage';
import * as allianceQueries from './alllianceQueries';
import { getPlayer, getPlayerWithInvites, getPlayerByName } from '../player/playerQueries';

// TODO: rework events
// TODO: better permissions, cnsider moving permissions to database
// TOOD: error handling use correct types
// TODO: update map data on diplo and member change
// TODO: chat messages need better handling

export class AllianceSocket {
  static onConnect(socket: UserSocket) {
    this.joinAllianceRoom(socket);

    socket.on('alliance:create', (name: string) => this.createAlliance(socket, name));
    socket.on('alliance:createInvite', (name: string) => this.createInvite(socket, name));
    socket.on('alliance:cancelInvite', (playerId: number) => this.cancelInvite(socket, playerId));
    socket.on('alliance:acceptInvite', (allianceId: number) => this.acceptInvite(socket, allianceId));
    socket.on('alliance:rejectInvite', (allianceId: number) => this.rejectInvite(socket, allianceId));
    socket.on('alliance:updateMemberRole', (payload: PlayerRolePayload) => this.updatePlayerRole(socket, payload));
    socket.on('alliance:updateRoles', (payload: RoleUpdatePayload) => this.updateRoles(socket, payload));
    socket.on('alliance:removeRole', (roleId: number) => this.removeRole(socket, roleId));
    socket.on('alliance:removeMember', (playerId: number) => this.removeMember(socket, playerId));
    socket.on('alliance:leave', () => this.leaveAlliance(socket));
    socket.on('alliance:destroy', () => this.destroyAlliance(socket));

    socket.on('alliance:declareWar', (payload: WarDeclarationPayload) => this.startWar(socket, payload));
    socket.on('alliance:proposeAlliance', (payload: string) => this.proposeDiplo(socket, payload, DiplomacyType.alliance));
    socket.on('alliance:proposeNap', (payload: string) => this.proposeDiplo(socket, payload, DiplomacyType.nap));
    socket.on('alliance:cancelAlliance', (payload: number) => this.cancelDiplo(socket, payload, DiplomacyType.alliance));
    socket.on('alliance:cancelNap', (payload: number) => this.cancelDiplo(socket, payload, DiplomacyType.nap));
    socket.on('alliance:rejectAlliance', (payload: number) => this.rejectDiplo(socket, payload, DiplomacyType.alliance));
    socket.on('alliance:rejectNap', (payload: number) => this.rejectDiplo(socket, payload, DiplomacyType.nap));
    socket.on('alliance:acceptAlliance', (payload: number) => this.acceptDiplo(socket, payload, DiplomacyType.alliance));
    socket.on('alliance:acceptNap', (payload: number) => this.acceptDiplo(socket, payload, DiplomacyType.nap));
    socket.on('alliance:endAlliance', (payload: number) => this.endDiplo(socket, payload, DiplomacyType.alliance));
    socket.on('alliance:endNap', (payload: number) => this.endDiplo(socket, payload, DiplomacyType.nap));

    socket.on('chat:postMessage', (payload: MessagePayload) => this.postMessage(socket, payload));
    // socket.on('alliance:createForumCategory', (payload: ForumCategoryPayload) => this.createForumCategory(socket, payload));
  }

  static joinAllianceRoom(socket: UserSocket) {
    if (socket.userData.allianceId) { socket.join(`alliance.${socket.userData.allianceId}`); }
  }

  static updateMemberPermission(roles: AllianceRole[], room: string) {
    const updatedRoleIds = roles.map(({ id }) => id);
    Object.keys(io.sockets.adapter.rooms[room].sockets).forEach((socketId: string) => {
      const client = io.sockets.connected[socketId] as UserSocket;
      if (updatedRoleIds.includes(client.userData.allianceRoleId)) {
        client.userData = {
          ...client.userData,
          alliancePermissions: roles.find(({ id }) => id === client.userData.allianceRoleId).permissions,
        };
      }
    });
  }

  static resetMemberRole(roleId: number, defaultRole: Partial<AllianceRole>, room: string) {
    Object.keys(io.sockets.adapter.rooms[room].sockets).forEach((socketId: string) => {
      const client = io.sockets.connected[socketId] as UserSocket;
      if (client.userData.allianceRoleId === roleId) {
        client.userData = {
          ...client.userData,
          allianceRoleId: defaultRole.id,
          alliancePermissions: defaultRole.permissions,
        };
      }
    });
  }

  static removeMemberNotify(playerId: number, allianceId: number) {
    const room = io.sockets.adapter.rooms[`player.${playerId}`];
    if (room) {
      this.resetRoomSocketAlliance(room.sockets, (client) => {
        this.leaveAllianceRoom(client, allianceId);
        client.emit('alliance:removed');
      });
    }
  }

  static destroyAllianceNotify(room: string) {
    io.sockets.in(room).emit('alliance:destroyed');
    this.resetRoomSocketAlliance(io.sockets.adapter.rooms[room].sockets, (client) => client.leave(room));
  }

  static leaveAllianceRoom(socket: AuthenticatedSocket, allianceId: number) {
    const room = `alliance.${allianceId}`;
    if (!!socket.rooms[room]) { socket.leave(room); }
  }

  static async createAlliance(socket: UserSocket, name: string) {
    const trx = await transaction.start(knexDb.world);
    try {
      // TODO: decide whether this check can be trusted
      if (socket.userData.allianceId !== null) { throw new ErrorMessage('Can\'t create alliance.'); }
      const alliance = await allianceQueries.createAlliance(socket.userData.playerId, name, trx);

      alliance.members = [{
        id: socket.userData.playerId,
        name: socket.userData.playerName,
        allianceRole: alliance.masterRole,
      }];
      alliance.eventOrigin[0].originPlayer = {
        id: socket.userData.playerId,
        name: socket.userData.playerName,
      };

      await trx.commit();

      socket.userData.allianceId = alliance.id;
      socket.userData.allianceName = alliance.name;
      socket.userData.allianceRoleId = alliance.masterRole.id;
      socket.userData.alliancePermissions = alliance.masterRole.permissions;
      mapManager.setTownAlliance({ id: alliance.id, name: alliance.name }, socket.userData.townIds);

      this.joinAllianceRoom(socket);
      socket.emit('alliance:createSuccess', alliance);
    } catch (err) {
      await trx.rollback();
      socket.handleError(err, 'createAlliance', 'alliance:createFail', name);
    }
  }

  static async createInvite(socket: UserSocket, targetName: string) {
    const trx = await transaction.start(knexDb.world);
    try {
      if (!socket.userData.alliancePermissions || !socket.userData.alliancePermissions.editInvites) { throw new ErrorMessage('Not permitted to edit invites'); }

      const alliance = await allianceQueries.getAllianceWithMembersInvites({ id: socket.userData.allianceId }, trx);

      if (!alliance || !this.hasItemByProp(alliance.members, socket.userData.playerId)) { throw new ErrorMessage('Can\'t invite player'); }

      const player = await getPlayerByName(targetName, trx);
      if (!player) { throw new ErrorMessage('No such player'); }
      if (this.hasItemByProp(alliance.invitations, player.id)) { throw new ErrorMessage('Player already invited'); }

      const playerProfile: Profile = {
        id: player.id,
        name: player.name,
      };

      const event = await allianceQueries.createInvite(player, socket.userData.playerId, alliance.id, trx);

      await trx.commit();

      const playerRoom = `player.${player.id}`;
      event.originPlayer = {
        id: socket.userData.playerId,
        name: socket.userData.playerName,
      };
      event.targetPlayer = playerProfile;

      socket.to(`alliance.${alliance.id}`).emit('alliance:event', { event, data: playerProfile });
      socket.emit(`alliance:createInviteSuccess`, { event, data: playerProfile });

      if (io.sockets.adapter.rooms[playerRoom]) {
        io.sockets.in(playerRoom).emit('alliance:invited', {
          id: alliance.id,
          name: alliance.name,
        });
      }
    } catch (err) {
      await trx.rollback();
      socket.handleError(err, 'createInvite', 'alliance:createInviteFail', targetName);
    }
  }

  static async cancelInvite(socket: UserSocket, playerId: number) {
    const trx = await transaction.start(knexDb.world);
    try {
      if (!socket.userData.alliancePermissions || !socket.userData.alliancePermissions.editInvites) { throw new ErrorMessage('Not permitted to edit invites'); }

      const alliance = await allianceQueries.getAllianceWithMembersInvites({ id: socket.userData.allianceId }, trx);

      if (!alliance || !this.hasItemByProp(alliance.members, socket.userData.playerId)) { throw new ErrorMessage('Can\'t invite player'); }
      const invitation = alliance.invitations.find(({ id }) => id === playerId);
      if (!invitation) { throw new ErrorMessage('Invitation doesn\'t exist'); }

      const event = await allianceQueries.cancelInvite(alliance, socket.userData.playerId, playerId, trx);

      await trx.commit();

      event.originAlliance = {
          id: alliance.id,
          name: alliance.name,
      };
      event.originPlayer = {
        id: socket.userData.playerId,
        name: socket.userData.playerName,
      };
      event.targetPlayer = {
        id: playerId,
        name: invitation.name,
      };

      socket.to(`alliance.${alliance.id}`).emit('alliance:event', { event, data: playerId });
      socket.emit(`alliance:cancelInviteSuccess`, { event, data: playerId });

      const playerRoom = `player.${playerId}`;
      if (io.sockets.adapter.rooms[playerRoom]) {
        io.sockets.in(playerRoom).emit('alliance:inviteCanceled', alliance.id);
      }
    } catch (err) {
      await trx.rollback();
      socket.handleError(err, 'cancelInvite', 'alliance:cancelInviteFail', playerId);
    }
  }

  static async rejectInvite(socket: UserSocket, allianceId: number) {
    const trx = await transaction.start(knexDb.world);
    try {

      const player = await getPlayerWithInvites({ id: socket.userData.playerId }, trx);

      if (!player || !this.hasItemByProp(player.invitations, allianceId)) { throw new ErrorMessage('Can\'t reject invitation'); }

      const event = await allianceQueries.rejectInvite(player, allianceId, socket.userData.playerId, trx);

      await trx.commit();

      socket.emit('alliance:rejectInviteSuccess', allianceId);
      event.originPlayer = {
        id: socket.userData.playerId,
        name: socket.userData.playerName,
      };
      io.sockets.in(`alliance.${allianceId}`).emit('alliance:event', { event, data: socket.userData.playerId  });
    } catch (err) {
      await trx.rollback();
      socket.handleError(err, 'rejectInvite', 'alliance:rejectInviteFail', allianceId);
    }
  }

  static async acceptInvite(socket: UserSocket, allianceId: number) {
    const trx = await transaction.start(knexDb.world);
    try {
      const player = await getPlayerWithInvites({ id: socket.userData.playerId }, trx);
      if (!player || !this.hasItemByProp(player.invitations, allianceId)) { throw new ErrorMessage('Can\'t reject invitation'); }

      const alliance = await allianceQueries.getFullAlliance({ id: allianceId }, trx);

      if (!alliance) { throw new ErrorMessage('Wrong alliance'); }

      const event = await allianceQueries.acceptInvite(player, alliance.id, alliance.defaultRoleId, trx);

      event.originPlayer = {
        id: socket.userData.playerId,
        name: socket.userData.playerName,
      };

      await trx.commit();

      const member = { ...event.originPlayer, allianceRole: alliance.defaultRole };
      alliance.members.push(member);
      alliance.eventOrigin.unshift(event);
      alliance.invitations = alliance.invitations.filter((id) => id !== player.id);

      io.sockets.in(`alliance.${alliance.id}`).emit('alliance:event', { event, data: member });
      mapManager.setTownAlliance({ id: alliance.id, name: alliance.name }, socket.userData.townIds);
      socket.emit('alliance:acceptInviteSuccess', alliance);
      socket.userData = {
        ...socket.userData,
        allianceId: alliance.id,
        allianceName: alliance.name,
        allianceRoleId: alliance.defaultRoleId,
        alliancePermissions: alliance.defaultRole.permissions,
      };
      this.joinAllianceRoom(socket);
    } catch (err) {
      await trx.rollback();
      socket.handleError(err, 'acceptInvite', 'alliance:acceptInviteFail', allianceId);
    }
  }

  static async updateRoles(socket: UserSocket, payload: RoleUpdatePayload) {
    const trx = await transaction.start(knexDb.world);
    try {
      if (!socket.userData.alliancePermissions || !socket.userData.alliancePermissions.manageRoles) { throw new ErrorMessage('Not permitted to manage roles'); }
      if (!payload || !payload.roles || !payload.newRoles || !(payload.roles.length || payload.newRoles.length)) {
        throw new ErrorMessage('Invalid payload');
      }

      const alliance = await allianceQueries.getAllianceWithRoles({ id: socket.userData.allianceId }, trx);

      if (!alliance) { throw new ErrorMessage('Wrong alliance'); }

      const masterRolePermissionChanged = payload.roles.some(({ id, permissions }) =>
        id === alliance.masterRoleId && this.permissionsChanged(alliance.roles.find((role) => role.id === alliance.masterRoleId).permissions, permissions));
      if (masterRolePermissionChanged) { throw new ErrorMessage('Can\'t change permissions'); }

      const updatedAlliance = await allianceQueries.updateRoles(alliance.id, [...payload.roles, ...payload.newRoles], socket.userData.playerId, trx);
      await trx.commit();

      const data = updatedAlliance.roles.reduce((result, role) => {
        const isUpdated = alliance.roles.some(({ id }) => id === role.id);
        result[isUpdated ? 'updated' : 'created'].push(role);
        return result;
      }, { created: [], updated: [] });

      const allianceRoom = `alliance.${socket.userData.allianceId}`;
      this.updateMemberPermission(data.updated, allianceRoom);

      const event = updatedAlliance.eventOrigin[0];
      event.originPlayer = {
        id: socket.userData.playerId,
        name: socket.userData.playerName,
      };

      socket.to(allianceRoom).emit('alliance:event', { event, data });
      socket.emit('alliance:updateRolePermissionsSuccess', { event, data });
    } catch (err) {
      await trx.rollback();
      socket.handleError(err, 'updateRoles', 'alliance:updateRolePermissionsFail', payload);
    }
  }

  static async removeRole(socket: UserSocket, roleId: number) {
    const trx = await transaction.start(knexDb.world);
    try {
      if (!socket.userData.alliancePermissions || !socket.userData.alliancePermissions.manageRoles) { throw new ErrorMessage('Not permitted to manage roles'); }

      const alliance = await allianceQueries.getAllianceWithMembersRoles({ id: socket.userData.allianceId }, trx);

      if (!alliance) { throw new ErrorMessage('Wrong alliance'); }

      const role = alliance.roles.find(({ id }) => id === roleId);
      const canRemoveRole = role.id !== alliance.defaultRoleId && role.id !== alliance.masterRoleId;
      if (!canRemoveRole) { throw new ErrorMessage('Wrong role'); }

      const event = await allianceQueries.removeRole(roleId, alliance, socket.userData.playerId, trx);

      await trx.commit();

      event.originPlayer = {
        id: socket.userData.playerId,
        name: socket.userData.playerName,
      };
      const data = { removed: [roleId] };
      const allianceRoom = `alliance.${alliance.id}`;
      this.resetMemberRole(roleId, role, allianceRoom);

      socket.emit(`alliance:removeRoleSuccess`, { event, data });
      socket.to(allianceRoom).emit('alliance:event', { event, data });
    } catch (err) {
      await trx.rollback();
      socket.handleError(err, 'removeRole', 'alliance:removeRoleFail', roleId);
    }
  }

  static async removeMember(socket: UserSocket, playerId: number) {
    const trx = await transaction.start(knexDb.world);
    try {
      if (!socket.userData.alliancePermissions || !socket.userData.alliancePermissions.manageRoles) { throw new ErrorMessage('Not permitted to manage roles'); }

      const alliance = await allianceQueries.getAllianceWithMembers({ id: socket.userData.allianceId }, trx);

      if (!alliance) { throw new ErrorMessage('Wrong alliance'); }
      const targetMember = alliance.members.find(({ id }) => id === playerId);

      if (!targetMember) { throw new ErrorMessage('Target player doesn\'t belong to alliance'); }
      if (playerId === socket.userData.playerId) { throw new ErrorMessage('Can\'t remove self, leave or destroy alliance instead'); }
      if (targetMember.allianceRoleId === alliance.masterRoleId) { throw new ErrorMessage('Can\'t remove members with master role'); }

      const query = await allianceQueries.removeMember(playerId, socket.userData.playerId, alliance.id, trx);
      const player = query.player;
      const event = query.event;

      await trx.commit();

      this.removeMemberNotify(player.id, alliance.id);

      event.originPlayer = {
        id: socket.userData.playerId,
        name: socket.userData.playerName,
      };
      event.targetPlayer = {
        id: player.id,
        name: player.name,
      };
      socket.emit(`alliance:removeMemberSuccess`, { event, data: playerId });
      socket.to(`alliance.${socket.userData.allianceId}`).emit('alliance:event', { event, data: playerId });
      } catch (err) {
      await trx.rollback();
      socket.handleError(err, 'removeMember', 'alliance:removeMemberFail', playerId);
    }
  }

  // !TODO: need to add success/fail corresponding events to frontend
  static async destroyAlliance(socket: UserSocket) {
    const trx = await transaction.start(knexDb.world);
    try {
      if (!socket.userData.alliancePermissions || !socket.userData.alliancePermissions.manageAlliance) { throw new ErrorMessage('Not permitted to do that'); }

      const allianceId = socket.userData.allianceId;

      await allianceQueries.destroyAlliance(allianceId, trx);

      await trx.commit();

      this.destroyAllianceNotify(`alliance.${allianceId}`);
    } catch (err) {
      await trx.rollback();
      socket.handleError(err, 'destroyAlliance', 'alliance:destroyFail');
    }
  }

  static async startWar(socket: UserSocket, payload: WarDeclarationPayload) {
    const trx = await transaction.start(knexDb.world);
    try {
      if (!socket.userData.alliancePermissions || !socket.userData.alliancePermissions.manageAlliance) { throw new ErrorMessage('Not permitted to do that'); }

      const alliances = await allianceQueries.getAllianceWithTarget({ id: socket.userData.allianceId }, payload.targetName, trx);

      if (!alliances || alliances.length !== 2) { throw new ErrorMessage('Wrong alliance'); }
      const target = alliances.findIndex(({ id }) => id !== socket.userData.allianceId);
      const targetAlliance = alliances[target];
      const alliance = alliances[Math.abs(target - 1)];

      const hasDiplo =
        alliance.diplomacyOrigin.some(({ targetAllianceId }) => targetAllianceId === targetAlliance.id) ||
        alliance.diplomacyTarget.some(({ originAllianceId }) => originAllianceId === targetAlliance.id);
      if (hasDiplo) { throw new ErrorMessage('Already involved in diplomacy with target alliance.'); }

      const query = await allianceQueries.startWar(socket.userData.playerId, socket.userData.allianceId, targetAlliance.id, payload.reason, trx);
      const war = query.diplomacy;
      const event = query.event;

      await trx.commit();

      const originPlayerProfile = { id: socket.userData.playerId, name: socket.userData.playerName };
      const originAllianceProfile = { id: socket.userData.allianceId, name: socket.userData.allianceName };
      const targetAllianceProfile = { id: targetAlliance.id, name: targetAlliance.name };

      war.originPlayer = originPlayerProfile;
      war.originAlliance = originAllianceProfile;
      war.targetAlliance = targetAllianceProfile;

      event.originPlayer = originPlayerProfile;
      event.targetAlliance = targetAllianceProfile;
      event.originAlliance = originAllianceProfile;

      socket.emit('alliance:declareWarSuccess', { event, data: war });
      socket.to(`alliance.${socket.userData.allianceId}`).emit('alliance:event', { event, data: war });
      socket.to(`alliance.${targetAlliance.id}`).emit('alliance:event', { event, data: war });
    } catch (err) {
      await trx.rollback();
      socket.handleError(err, 'startWar', 'alliance:declareWarFail');
    }
  }

  static async proposeDiplo(socket: UserSocket, targetName: string, type: number) {
    const typeName = diplomacyTypeName[type];
    const trx = await transaction.start(knexDb.world);
    try {
      if (!socket.userData.alliancePermissions || !socket.userData.alliancePermissions.manageAlliance) { throw new ErrorMessage('Not permitted to do that'); }

      const alliances = await allianceQueries.getAllianceWithTarget({ id: socket.userData.allianceId }, targetName, trx);

      if (!alliances || alliances.length !== 2) { throw new ErrorMessage('Wrong alliance'); }

      const target = alliances.findIndex(({ id }) => id !== socket.userData.allianceId);
      const targetAlliance = alliances[target];
      const alliance = alliances[Math.abs(target - 1)];

      const hasDiplo =
        alliance.diplomacyOrigin.some(({ targetAllianceId }) => targetAllianceId === targetAlliance.id) ||
        alliance.diplomacyTarget.some(({ originAllianceId }) => originAllianceId === targetAlliance.id);
      if (hasDiplo) { throw new ErrorMessage('Already involved in diplomacy with target alliance.'); }

      const query = await allianceQueries.proposeDiplomacy(socket.userData.playerId, socket.userData.allianceId, targetAlliance.id, type, trx);
      const diplomacy = query.diplomacy;
      const event = query.event;

      await trx.commit();

      const originPlayerProfile = { id: socket.userData.playerId, name: socket.userData.playerName };
      const originAllianceProfile = { id: socket.userData.allianceId, name: socket.userData.allianceName };
      const targetAllianceProfile = { id: targetAlliance.id, name: targetAlliance.name };

      diplomacy.originPlayer = originPlayerProfile;
      diplomacy.originAlliance = originAllianceProfile;
      diplomacy.targetAlliance = targetAllianceProfile;

      event.originPlayer = originPlayerProfile;
      event.targetAlliance = targetAllianceProfile;
      event.originAlliance = originAllianceProfile;

      socket.emit(`alliance:propose${typeName}Success`, { event, data: diplomacy });
      socket.to(`alliance.${socket.userData.allianceId}`).emit('alliance:event', { event, data: diplomacy });
      socket.to(`alliance.${targetAlliance.id}`).emit('alliance:event', { event, data: diplomacy });
    } catch (err) {
      await trx.rollback();
      socket.handleError(err, `propose${typeName}`, `alliance:propose${typeName}Fail`);
    }
  }

  static async cancelDiplo(socket: UserSocket, targetId: number, type: number) {
    const typeName = diplomacyTypeName[type];
    const trx = await transaction.start(knexDb.world);
    try {
      if (!socket.userData.alliancePermissions || !socket.userData.alliancePermissions.manageAlliance) { throw new ErrorMessage('Not permitted to do that'); }

      const diplomacy = await allianceQueries.getDiplomacy({ id: targetId }, trx);
      const targetAlliance = diplomacy.targetAlliance;

      if (!diplomacy || diplomacy.originAllianceId !== socket.userData.allianceId) { throw new ErrorMessage(`Can't cancel diplomacy`); }
      if (diplomacy.status !== DiplomacyStatus.pending) { throw new ErrorMessage(`Diplomacy is already active`); }

      const event = await allianceQueries.cancelDiplomacy(
        diplomacy,
        socket.userData.playerId,
        socket.userData.allianceId,
        targetAlliance.id,
        EventStatus[`cancel${typeName}`],
        trx,
      );

      await trx.commit();

      const originPlayerProfile = { id: socket.userData.playerId, name: socket.userData.playerName };
      const originAllianceProfile = { id: socket.userData.allianceId, name: socket.userData.allianceName };
      const targetAllianceProfile = { id: targetAlliance.id, name: targetAlliance.name };

      event.originPlayer = originPlayerProfile;
      event.targetAlliance = targetAllianceProfile;
      event.originAlliance = originAllianceProfile;

      socket.emit(`alliance:cancel${typeName}Success`, { event, data: targetId });
      socket.to(`alliance.${socket.userData.allianceId}`).emit('alliance:event', { event, data: targetId });
      socket.to(`alliance.${targetAlliance.id}`).emit('alliance:event', { event, data: targetId });
    } catch (err) {
      await trx.rollback();
      socket.handleError(err, `cancel${typeName}`, `alliance:cancel${typeName}Fail`);
    }
  }

  static async rejectDiplo(socket: UserSocket, targetId: number, type: number) {
    const typeName = diplomacyTypeName[type];
    const trx = await transaction.start(knexDb.world);
    try {
      if (!socket.userData.alliancePermissions || !socket.userData.alliancePermissions.manageAlliance) { throw new ErrorMessage('Not permitted to do that'); }

      const diplomacy = await allianceQueries.getDiplomacy({ id: targetId }, trx);
      const targetAlliance = diplomacy.targetAlliance;
      const originAlliance = diplomacy.originAlliance;

      if (!diplomacy || diplomacy.targetAllianceId !== socket.userData.allianceId) { throw new ErrorMessage(`Can't reject diplomacy`); }
      if (diplomacy.status !== DiplomacyStatus.pending) { throw new ErrorMessage(`Diplomacy is already active`); }

      const event = await allianceQueries.cancelDiplomacy(
        diplomacy,
        socket.userData.playerId,
        socket.userData.allianceId,
        targetAlliance.id,
        EventStatus[`reject${typeName}`],
        trx,
      );

      await trx.commit();

      const originPlayerProfile = { id: socket.userData.playerId, name: socket.userData.playerName };
      const originAllianceProfile = { id: socket.userData.allianceId, name: socket.userData.allianceName };
      const targetAllianceProfile = { id: targetAlliance.id, name: targetAlliance.name };

      event.originPlayer = originPlayerProfile;
      event.targetAlliance = targetAllianceProfile;
      event.originAlliance = originAllianceProfile;

      socket.emit(`alliance:reject${typeName}Success`, { event, data: targetId });
      socket.to(`alliance.${socket.userData.allianceId}`).emit('alliance:event', { event, data: targetId });
      socket.to(`alliance.${originAlliance.id}`).emit('alliance:event', { event, data: targetId });
    } catch (err) {
      await trx.rollback();
      socket.handleError(err, `reject${typeName}`, `alliance:reject${typeName}Fail`);
    }
  }

  static async acceptDiplo(socket: UserSocket, targetId: number, type: number) {
    const typeName = diplomacyTypeName[type];
    const trx = await transaction.start(knexDb.world);
    try {
      if (!socket.userData.alliancePermissions || !socket.userData.alliancePermissions.manageAlliance) { throw new ErrorMessage('Not permitted to do that'); }

      const diplomacy = await allianceQueries.getDiplomacy({ id: targetId }, trx);
      const targetAlliance = diplomacy.targetAlliance;
      const originAlliance = diplomacy.originAlliance;

      if (!diplomacy || diplomacy.targetAllianceId !== socket.userData.allianceId) { throw new ErrorMessage(`Can't accept diplomacy`); }
      if (diplomacy.status !== DiplomacyStatus.pending) { throw new ErrorMessage(`Diplomacy is already active`); }

      const query = await allianceQueries.acceptDiplomacy(diplomacy, socket.userData.playerId, trx);
      const event = query.event;

      await trx.commit();

      const originPlayerProfile = { id: socket.userData.playerId, name: socket.userData.playerName };
      const originAllianceProfile = { id: socket.userData.allianceId, name: socket.userData.allianceName };
      const targetAllianceProfile = { id: targetAlliance.id, name: targetAlliance.name };

      event.originPlayer = originPlayerProfile;
      event.targetAlliance = targetAllianceProfile;
      event.originAlliance = originAllianceProfile;

      socket.emit(`alliance:accept${typeName}Success`, { event, data: targetId });
      socket.to(`alliance.${socket.userData.allianceId}`).emit('alliance:event', { event, data: targetId });
      socket.to(`alliance.${originAlliance.id}`).emit('alliance:event', { event, data: targetId });
    } catch (err) {
      await trx.rollback();
      socket.handleError(err, `accept${typeName}`, `alliance:accept${typeName}Fail`);
    }
  }

  static async endDiplo(socket: UserSocket, targetId: number, type: number) {
    const typeName = diplomacyTypeName[type];
    const trx = await transaction.start(knexDb.world);
    try {
      if (!socket.userData.alliancePermissions || !socket.userData.alliancePermissions.manageAlliance) { throw new ErrorMessage('Not permitted to do that'); }

      const diplomacy = await allianceQueries.getDiplomacy({ id: targetId }, trx);

      if (!diplomacy || !(diplomacy.targetAllianceId === socket.userData.allianceId || diplomacy.originAllianceId === socket.userData.allianceId)) {
        throw new ErrorMessage(`Can't end diplomacy`);
      }
      if (diplomacy.status !== DiplomacyStatus.ongoing) { throw new ErrorMessage(`Diplomacy is not  active`); }
      const targetAlliance = diplomacy.targetAlliance.id === socket.userData.allianceId ? diplomacy.originAlliance : diplomacy.targetAlliance;

      const event = await allianceQueries.cancelDiplomacy(
        diplomacy,
        socket.userData.playerId,
        socket.userData.allianceId,
        targetAlliance.id,
        EventStatus[`end${typeName}`],
        trx,
      );

      await trx.commit();

      const originPlayerProfile = { id: socket.userData.playerId, name: socket.userData.playerName };
      const originAllianceProfile = { id: socket.userData.allianceId, name: socket.userData.allianceName };
      const targetAllianceProfile = { id: targetAlliance.id, name: targetAlliance.name };

      event.originPlayer = originPlayerProfile;
      event.targetAlliance = targetAllianceProfile;
      event.originAlliance = originAllianceProfile;

      socket.emit(`alliance:end${typeName}Success`, { event, data: targetId });
      socket.to(`alliance.${socket.userData.allianceId}`).emit('alliance:event', { event, data: targetId });
      socket.to(`alliance.${targetAlliance.id}`).emit('alliance:event', { event, data: targetId });
    } catch (err) {
      await trx.rollback();
      socket.handleError(err, `end${typeName}`, `alliance:end${typeName}Fail`);
    }
  }

  static async updatePlayerRole(socket: UserSocket, payload: PlayerRolePayload) {
    const trx = await transaction.start(knexDb.world);
    try {
      if (!socket.userData.alliancePermissions || !socket.userData.alliancePermissions.manageRoles) { throw new ErrorMessage('Not permitted to do that'); }

      const alliance = await allianceQueries.getAllianceWithMembersRoles({ id: socket.userData.allianceId }, trx);

      if (!alliance) { throw new ErrorMessage('Wrong alliance'); }

      const player = alliance.members.find(({ id }) => id === payload.playerId);
      if (!player) { throw new ErrorMessage('Invalid target player'); }

      const role = alliance.roles.find(({ id }) => id === payload.roleId);
      if (!role) { throw new ErrorMessage('Invalid target role'); }

      const playerRole = alliance.roles.find(({ id }) => id === player.allianceRoleId);
      if (playerRole.id === alliance.masterRoleId) {
        if (player.id !== socket.userData.playerId) { throw new ErrorMessage('Can\'t edit other owner role'); }
        const masterRoleCount = alliance.members.reduce((result, { allianceRoleId }) => result += +(allianceRoleId === alliance.masterRoleId) , 0);
        if (player.id === socket.userData.playerId && masterRoleCount < 2) { throw new ErrorMessage('Alliance must have at least one owner'); }
      }
      const oldRoleId = player.allianceRoleId;

      const event = await allianceQueries.updatePlayerRole(payload.roleId, player.id, socket.userData.playerId, alliance.id);

      await trx.commit();

      event.originPlayer = {
        id: socket.userData.playerId,
        name: socket.userData.playerName,
      };
      event.targetPlayer = {
        id: player.id,
        name: player.name,
      };
      const data = { updatedMember: [{ id: player.id, role }] };
      const allianceRoom = `alliance.${alliance.id}`;

      this.resetMemberRole(oldRoleId, role, `player.${player.id}`);
      socket.emit('alliance:updateMemberRoleSuccess', { event, data });
      socket.to(allianceRoom).emit('alliance:event', { event, data });
    } catch (err) {
      await trx.rollback();
      socket.handleError(err, `updateMemberRole`, `alliance:updateMemberRoleFail`);
    }
  }

  static async leaveAlliance(socket: UserSocket) {
    const trx = await transaction.start(knexDb.world);
    try {
      const allianceId = socket.userData.allianceId;
      const alliance = await allianceQueries.getAllianceWithMembersRoles({ id: socket.userData.allianceId }, trx);

      if (!alliance) { throw new ErrorMessage('Wrong alliance'); }
      if (alliance.masterRoleId === socket.userData.allianceRoleId) { throw new ErrorMessage('Owner can\'t leave alliance'); }

      const event = await allianceQueries.leaveAlliance(socket.userData.playerId, alliance.id, trx);

      await trx.commit();

      event.originPlayer = {
        id: socket.userData.playerId,
        name: socket.userData.playerName,
      };
      socket.userData = this.cleanSocketAlliance(socket.userData);
      this.leaveAllianceRoom(socket, allianceId);
      mapManager.setTownAlliance({ id: alliance.id, name: alliance.name }, socket.userData.townIds);

      socket.emit('alliance:leaveAllianceSuccess');
      io.sockets.in(`alliance.${allianceId}`).emit('alliance:event', { event, data: socket.userData.playerId });
    } catch (err) {
      await trx.rollback();
      socket.handleError(err, 'leaveAlliance', 'alliance:leaveAllianceFail');
    }
  }

  static async postMessage(socket: UserSocket, payload: MessagePayload) {
    try {
      const message = await allianceQueries.addMessage(payload.text, socket.userData.playerId, socket.userData.allianceId);
      message.player = { name: socket.userData.playerName };
      socket.emit('chat:postMessageSuccess', { message, messageStamp: payload.messageStamp });
      socket.broadcast.to(`alliance.${socket.userData.allianceId}`).emit('chat:newMessage', message);
    } catch (err) {
      socket.handleError(err, 'postMessage');
    }
  }

  static resetRoomSocketAlliance(room, clientAction = (client: UserSocket) => null) {
    Object.keys(room).forEach((socketId: string) => {
      const client = io.sockets.connected[socketId] as UserSocket;
      client.userData = this.cleanSocketAlliance(client.userData);
      mapManager.setTownAlliance(null, client.userData.townIds);
      clientAction(client);
    });
  }

  static cleanSocketAlliance(data) {
    return {
      ...data,
      allinaceId: null,
      allianceName: null,
      allianceRoleId: null,
      alliancePermissions: null,
    };
  }

  static hasItemByProp(items: any[], value: string | number, prop = 'id') {
    return items.some((item) => item[prop] === value);
  }

  static permissionsChanged(oldPermissions: AlliancePermissions, newPermissions: AlliancePermissions) {
    const oldEntries = Object.entries(oldPermissions);
    const newEntries = Object.entries(newPermissions);
    return oldEntries.length === newEntries.length && Object.entries(oldPermissions).every(([name, value]) => newPermissions[name] === value);
  }
}
