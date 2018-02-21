import { world } from '../../sqldb';
import { Player } from '../world/player.model';
import { Alliance, allianceIncludes } from './alliance.model';
import { io } from '../../';
import { WhereOptions, Transaction } from 'sequelize';
import { AllianceRole, AlliancePermissions } from './allianceRole.model';
import { UserSocket, AuthenticatedSocket } from 'config/socket';
import { AllianceForumCategory } from './allianceForumCategory.model';
import { AllianceMessage } from './allianceMessage.model';
import { AllianceEvent } from './allianceEvent.model';
import { WarDeclarationPayload, AllianceDiplomacy } from './allianceDiplomacy.model';

// TODO: overiew permissions everywhere
export interface PlayerRolePayload {
  playerId: number;
  roleId: number;
}

export interface RoleUpdatePayload {
  roles: AllianceRole[];
  newRoles: AllianceRole[];
}

export interface ForumCategoryPayload {
  name: string;
  description: string;
}

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
    socket.on('alliance:removeRole', (roleId) => this.removeRole(socket, roleId));
    socket.on('alliance:removeMember', (playerId) => this.removeMember(socket, playerId));
    socket.on('alliance:leave', () => this.leaveAlliance(socket));
    socket.on('alliance:destroy', () => this.destroyAlliance(socket));

    socket.on('alliance:declareWar', (payload: WarDeclarationPayload) => this.startWar(socket, payload));
    socket.on('alliance:proposeAlliance', (payload: string) => this.proposeDiplo(socket, payload, 'alliance'));
    socket.on('alliance:proposeNap', (payload: string) => this.proposeDiplo(socket, payload, 'nap'));
    socket.on('alliance:cancelAlliance', (payload: number) => this.cancelDiplo(socket, payload, 'alliance'));
    socket.on('alliance:cancelNap', (payload: number) => this.cancelDiplo(socket, payload, 'nap'));
    socket.on('alliance:rejectAlliance', (payload: number) => this.rejectDiplo(socket, payload, 'alliance'));
    socket.on('alliance:rejectNap', (payload: number) => this.rejectDiplo(socket, payload, 'nap'));
    socket.on('alliance:acceptAlliance', (payload: number) => this.acceptDiplo(socket, payload, 'alliance'));
    socket.on('alliance:acceptNap', (payload: number) => this.acceptDiplo(socket, payload, 'nap'));
    socket.on('alliance:endAlliance', (payload: number) => this.endDiplo(socket, payload, 'alliance'));
    socket.on('alliance:endNap', (payload: number) => this.endDiplo(socket, payload, 'nap'));

    socket.on('chat:postMessage', (message: string) => this.postMessage(socket, message));
    // socket.on('alliance:createForumCategory', (payload: ForumCategoryPayload) => this.createForumCategory(socket, payload));
  }

  static joinAllianceRoom(socket: UserSocket) {
    if (socket.userData.allianceId) { socket.join(`alliance.${socket.userData.allianceId}`); }
  }

  static leaveAllianceRoom(socket: AuthenticatedSocket, allianceId: number) {
    const room = `alliance.${allianceId}`;
    if (!!socket.rooms[room]) { socket.leave(room); }
  }

  private static createAlliance(socket: UserSocket, name: string) {
    if (socket.userData.allianceId !== null) { return Promise.reject('Can\'t create alliance.'); }

    return Player.getPlayer({ id: socket.userData.playerId })
      .then((player) => {
        // TODO: decide whether this check is required or the store data can be trusted
        if (player.AllianceId !== null) { return Promise.reject('Can\'t create alliance.'); }

        return world.sequelize.transaction((transaction) =>
          Alliance.create({
            name,
            Roles: [{
              name: 'Owner',
              permissions: {
                viewInvites: true,
                editInvites: true,
                manageForum: true,
                editProfile: true,
                viewManagement: true,
                manageRoles: true,
                manageAlliance: true,
              },
            }, {
              name: 'Member',
            }],
          }, {
            include: [{ all: true }],
            transaction,
          })
          .then((alliance) => {
            alliance.MasterRoleId = alliance.Roles[0].id;
            alliance.DefaultRoleId = alliance.Roles[1].id;
            return alliance.save({ transaction });
          })
          .then((alliance) => {
            player.AllianceId = alliance.id;
            player.AllianceRoleId = alliance.Roles[0].id;
            return player.save({ transaction });
          })
          .then(() => AllianceEvent.create({
            type: 'management',
            status: 'create',
            OriginPlayerId: socket.userData.playerId,
            OriginAllianceId: player.AllianceId,
          }, { transaction }))
          .then(() => Alliance.getAlliance({ id: player.AllianceId }, transaction)),
        )
        .then((alliance) => {
          socket.userData = {
            ...socket.userData,
            allianceId: player.AllianceId,
            allianceName: player.name,
            allianceRoleId: player.AllianceRoleId,
            alliancePermissions: alliance.Roles[0].permissions,
          };
          this.joinAllianceRoom(socket);
          socket.emit('alliance:createSuccess', { alliance, role: alliance.Roles[0] });
        });
    });
  }

  private static createInvite(socket: UserSocket, targetName: string) {
    let invitingAlliance: Alliance;
    let invitedPlayer: Player;
    let createdInvite;

    return world.sequelize.transaction((transaction) =>
      Alliance.getAlliance({ id: socket.userData.allianceId }, transaction).then((alliance) => {
        // TODO: add additional permission check
        if (!alliance || !this.hasItemById(alliance.Members, socket.userData.playerId)) {
          return Promise.reject('Can\'t invite player.');
        }
        invitingAlliance = alliance;
        return Player.findOne({
          transaction,
          where: {
            name: targetName,
          },
          include: [{
            model: Alliance,
            as: 'Invitations',
          }],
        });
      }).then((player) => {
        // TODO: look for certain if invite existance can't be checked in sql
        if (!player || this.hasItemById(player.Invitations, invitingAlliance.id)) {
          return Promise.reject('Can\'t invite player.');
        }
        invitedPlayer = player;
        return invitingAlliance.addInvitation([player], { transaction });
      }).then((invite) => {
        createdInvite = invite[0][0];
        return AllianceEvent.create({
          type: 'invitation',
          status: 'create',
          OriginAllianceId: invitingAlliance.id,
          OriginPlayerId: socket.userData.playerId,
          TargetPlayerId: invitedPlayer.id,
        }, { transaction });
      }).then((ev) => {
        // TODO: Look into type fix
        // socket.emit('alliance', alliance);
        const invite = {
          id: createdInvite.PlayerId,
          name: targetName,
        };
        const playerRoom = `player.${invitedPlayer.id}`;
        const event: any = ev.get();
        event.OriginPlayer = {
          id: socket.userData.playerId,
          name: socket.userData.playerName,
        };
        event.TargetPlayer = {
          id: invitedPlayer.id,
          name: invitedPlayer.name,
        };

        socket.to(`alliance.${invitingAlliance.id}`).emit('alliance:event', { event, data: invite });
        socket.emit(`alliance:createInviteSuccess`, { event, data: invite });

        if (io.sockets.adapter.rooms[playerRoom]) {
          io.sockets.in(playerRoom).emit('alliance:invited', {
            id: invitingAlliance.id,
            name: invitingAlliance.name,
          });
        }
      }),
    );
  }

  private static cancelInvite(socket: UserSocket, playerId: number) {
    let targetAlliance: Alliance;
    let invite;

    return world.sequelize.transaction((transaction) =>
      Alliance.getAlliance({ id: socket.userData.allianceId }, transaction).then((alliance) => {
        // TODO: add additional permission check
        if (!alliance || !this.hasItemById(alliance.Members, socket.userData.playerId)) {
          return Promise.reject('Wrong alliance.');
        }

        invite = alliance.Invitations.find(({ id }) => id === playerId);
        if (!invite) { return Promise.reject('Wrong invitation.'); }

        targetAlliance = alliance;
        return alliance.removeInvitation(playerId, { transaction });
      })
      .then(() => AllianceEvent.create({
        type: 'invitation',
        status: 'cancel',
        OriginAllianceId: targetAlliance.id,
        OriginPlayerId: socket.userData.playerId,
        TargetPlayerId: playerId,
      }, { transaction }))
      .then((ev) => {
        // const alliance: any = targetAlliance.get();
        // alliance.Invitations.splice(inviteIndex, 1);
        // socket.emit('alliance', alliance);

        const event: any = ev.get();
        event.OriginPlayer = {
          id: socket.userData.playerId,
          name: socket.userData.playerName,
        };
        event.TargetPlayer = {
          id: playerId,
          name: invite.name,
        };

        socket.to(`alliance.${targetAlliance.id}`).emit('alliance:event', { event, data: invite.id });
        socket.emit(`alliance:cancelInviteSuccess`, { event, data: invite.id });

        const playerRoom = `player.${playerId}`;
        if (io.sockets.adapter.rooms[playerRoom]) {
          io.sockets.in(playerRoom).emit('alliance:inviteCanceled', targetAlliance.id);
        }
      }),
    );
  }

  private static rejectInvite(socket: UserSocket, allianceId: number) {
    return world.sequelize.transaction((transaction) =>
      Player.getPlayer({ id: socket.userData.playerId }, transaction).then((player) => {
        if (!player) { return Promise.reject('Wrong player.'); }

        const invite = player.Invitations.find(({ id }) => id === allianceId);
        if (!invite) { return Promise.reject('Wrong invitation.'); }

        return player.removeInvitation(allianceId, { transaction });
      }).then(() => AllianceEvent.create({
        type: 'invitation',
        status: 'reject',
        OriginPlayerId: socket.userData.playerId,
        // TODO: consider if this should use Origin alliance instead of target
        // if player is not a part
        OriginAllianceId: allianceId,
      } , { transaction }))
      .then((ev) => {
        socket.emit('alliance:rejectInviteSuccess', allianceId);

        const event: any = ev.get();
        event.OriginPlayer = {
          id: socket.userData.playerId,
          name: socket.userData.playerName,
        };
        io.sockets.in(`alliance.${allianceId}`).emit('alliance:event', { event, data: socket.userData.playerId  });
      }),
    );
  }

  private static acceptInvite(socket: UserSocket, allianceId: number) {
    let targetPlayer: Player;
    let invite;
    let alliance;
    let event;

    return world.sequelize.transaction((transaction) =>
      Player.getPlayer({ id: socket.userData.playerId }, transaction).then((player) => {
        if (!player) { return Promise.reject('Wrong player.'); }

        invite = player.Invitations.find(({ id }) => id === allianceId);
        if (invite === -1) { return Promise.reject('Wrong invitation.'); }

        targetPlayer = player;
        return player.removeInvitation(allianceId, { transaction });
      })
      .then(() => Alliance.getAlliance({ id: allianceId }, transaction))
      .then((ally) => {
        targetPlayer.AllianceId = allianceId;
        targetPlayer.AllianceRoleId = ally.DefaultRoleId;
        alliance = ally.get();
        return targetPlayer.save({ transaction });
      }).then(() => AllianceEvent.create({
        type: 'membership',
        status: 'join',
        OriginPlayerId: targetPlayer.id,
        OriginAllianceId: allianceId,
      }, { transaction }))
      .then((ev) => {
        event = ev.get();
        event.OriginPlayer = {
          id: socket.userData.playerId,
          name: socket.userData.playerName,
        };

        const member = {
          id: targetPlayer.id,
          name: targetPlayer.name,
          AllianceRole: alliance.DefaultRole,
        };
        alliance.Members.push(member);
        alliance.Events.unshift(event);
        alliance.Invitations = alliance.Invitations.filter((id) => id !== targetPlayer.id);

        io.sockets.in(`alliance.${alliance.id}`).emit('alliance:event', { event, data: member});
        socket.emit('alliance:acceptInviteSuccess', alliance);
        socket.userData = {
          ...socket.userData,
          allianceId: alliance.id,
          allianceName: alliance.name,
          allianceRoleId: alliance.DefaultRoleId,
          alliancePermissions: alliance.DefaultRole.permissions,
        };
        this.joinAllianceRoom(socket);
      }),
    );
  }

  private static updateRoles(socket: UserSocket, payload: RoleUpdatePayload) {
    const { roles, newRoles } = payload;
    let hasNewRoles = false;
    const updatedRoles = {
      created: [],
      updated: [],
    };
    return world.sequelize.transaction((transaction) =>
      Alliance.getAlliance({ id: socket.userData.allianceId }, transaction).then((alliance) => {
        if (!alliance) { return Promise.reject('Wrong alliance.'); }

        const masterRolePermissionChanged = roles.some(({ id, permissions }) =>
          id === alliance.MasterRoleId && this.permissionsChanged(alliance.Roles.find((role) => role.id === alliance.MasterRoleId).permissions, permissions));
        if (masterRolePermissionChanged) { return Promise.reject('Can\'t change permissions.'); }

        const actions = [];
        if (newRoles.length) {
          const rolesToCreate = newRoles.map(({ name, permissions }) => ({
            name,
            permissions,
            AllianceId: alliance.id,
          }));
          hasNewRoles = true;
          actions.push(AllianceRole.bulkCreate(rolesToCreate, { returning: true, transaction }));
        }

        if (roles.length) {
          roles.forEach((role) => {
            const rIndex = alliance.Roles.findIndex((exRole) => exRole.id === role.id);
            const storedRole = alliance.Roles[rIndex];

            storedRole.name = role.name;
            storedRole.permissions = role.permissions;
            actions.push(storedRole.save({ transaction }));
          });
        }

        return Promise.all(actions);
      })
      .then((savedRoles) => {
        if (hasNewRoles) { updatedRoles.created = savedRoles[0]; }
        updatedRoles.updated = hasNewRoles ? savedRoles.slice(1) : savedRoles;
        return AllianceEvent.create({
          type: 'roles',
          status: 'update',
          OriginPlayerId: socket.userData.playerId,
          OriginAllianceId: socket.userData.allianceId,
        });
      }),
    )
      .then((ev) => {
        const event = ev.get();
        event.OriginPlayer = {
          id: socket.userData.playerId,
          name: socket.userData.playerName,
        };
        // TODO: shoould send actually updated roles instead of same payload
        const data = {
          created: updatedRoles.created,
          updated: updatedRoles.updated,
        };
        const allianceRoom = `alliance.${socket.userData.allianceId}`;
        socket.to(allianceRoom).emit('alliance:event', { event, data });
        socket.emit('alliance:updateRolePermissionsSuccess', { event, data });

        const updatedRoleIds = payload.roles.map(({ id }) => id);
        Object.keys(io.sockets.adapter.rooms[allianceRoom].sockets).forEach((socketId: string) => {
          const client = io.sockets.connected[socketId] as UserSocket;
          if (updatedRoleIds.includes(client.userData.allianceRoleId)) {
            client.userData = {
              ...client.userData,
              alliancePermissions: payload.roles.find(({ id }) => id === client.userData.allianceRoleId).permissions,
            };
          }
        });
      });
  }

  private static removeRole(socket: UserSocket, roleId: number) {
    let ally;

    return world.sequelize.transaction((transaction) =>
      Alliance.getAlliance({ id: socket.userData.allianceId }, transaction)
        .then((alliance) => {
          if (!alliance) { return Promise.reject('Wrong alliance.'); }

          const target = alliance.Roles.find(({ id }) => id === roleId && id !== alliance.DefaultRoleId && id !== alliance.MasterRoleId);
          if (!target) { return Promise.reject('Wrong role'); }

          ally = alliance;
          return Player.update(
            { AllianceRoleId: alliance.DefaultRoleId },
            { where: { AllianceRoleId: roleId, AllianceId: alliance.id }, transaction },
          );
        })
        .then(() => AllianceRole.destroy({ where: { id: roleId }, transaction }))
        .then(() => AllianceEvent.create({
          type: 'roles',
          status: 'update',
          OriginPlayerId: socket.userData.playerId,
          OriginAllianceId: socket.userData.allianceId,
        }, { transaction })),
    )
      .then((ev) => {
        const event = ev.get();
        event.OriginPlayer = {
          id: socket.userData.playerId,
          name: socket.userData.playerName,
        };
        const data = { removed: [roleId] };
        const allianceRoom = `alliance.${ally.id}`;
        socket.emit(`alliance:removeRoleSuccess`, { event, data });
        socket.to(allianceRoom).emit('alliance:event', { event, data });

        Object.keys(io.sockets.adapter.rooms[allianceRoom].sockets).forEach((socketId: string) => {
          const client = io.sockets.connected[socketId] as UserSocket;
          if (client.userData.allianceRoleId === roleId) {
            client.userData = {
              ...client.userData,
              allianceRoleId: ally.DefaultRoleId,
              alliancePermissions: ally.DefaultRole.permissions,
            };
          }
        });
      });
  }

  private static removeMember(socket: UserSocket, playerId: number) {
    let playerName;
    return world.sequelize.transaction((transaction) =>
      Alliance.getAlliance({ id: socket.userData.allianceId }, transaction)
        .then((alliance) => {
          if (!alliance) { return Promise.reject('Can\t remove member.'); }

          playerName = alliance.Members.find(({ id }) => id === playerId);
          return Player.update({
            AllianceId: null,
            AllianceRoleId: null,
          }, {
            where: {
              id: playerId,
              AllianceId: socket.userData.allianceId,
            },
            transaction,
          });
        })
        .then(() => AllianceEvent.create({
          type: 'membership',
          status: 'remove',
          OriginPlayerId: socket.userData.playerId,
          TargetPlayerId: playerId,
          OriginAllianceId: socket.userData.allianceId,
        }, { transaction })),
    )
      .then((ev: AllianceEvent) => {
        const room = io.sockets.adapter.rooms[`player.${playerId}`];
        if (room) {
          Object.keys(room.sockets).forEach((socketId: string) => {
            const client = io.sockets.connected[socketId] as UserSocket;
            client.userData = {
              ...client.userData,
              allianceId: null,
              allianceName: null,
              allianceRoleId: null,
              alliancePermissions: null,
            };
            playerName = client.userData.playerName;
            this.leaveAllianceRoom(client, socket.userData.allianceId);
            client.emit('alliance:removed');
          });
        }

        const event: any = ev.get();
        event.OriginPlayer = {
          id: socket.userData.playerId,
          name: socket.userData.playerName,
        };
        event.TargetPlayer = {
          id: playerId,
          name: playerName,
        };
        socket.emit(`alliance:removeMemberSuccess`, { event, data: playerId });
        socket.to(`alliance.${socket.userData.allianceId}`).emit('alliance:event', { event, data: playerId });
    });
  }

  private static destroyAlliance(socket: UserSocket) {
    const allianceId = socket.userData.allianceId;
    return world.sequelize.transaction((transaction) =>
      AllianceRole.destroy({ where: { AllianceId: allianceId }, transaction })
        .then(() => Alliance.destroy({ where: { id: allianceId }, transaction })),
    )
    .then(() => {
      const room = `alliance.${allianceId}`;
      io.sockets.in(room).emit('alliance:destroyed');
      Object.keys(io.sockets.adapter.rooms[room].sockets).forEach((socketId: string) => {
        const client = io.sockets.connected[socketId] as UserSocket;
        client.userData = {
          ...client.userData,
          allianceId: null,
          allianceName: null,
          allianceRoleId: null,
          alliancePermissions: null,
        };
        client.leave(room);
      });
    });
  }

  private static startWar(socket: UserSocket, payload: WarDeclarationPayload) {
    let ally: Alliance;
    let diplo: AllianceDiplomacy;

    return world.sequelize.transaction((transaction) =>
      Alliance.getAlliance({ name: payload.targetName }, transaction)
        .then((alliance) => {
          if (!alliance) { return Promise.reject('Wrong alliance.'); }
          ally = alliance;

          let hasDiplo = alliance.DiplomacyOrigin.some(({ TargetAllianceId }) => TargetAllianceId === socket.userData.allianceId);
          hasDiplo = hasDiplo || alliance.DiplomacyTarget.some(({ OriginAllianceId }) => OriginAllianceId === socket.userData.allianceId);
          if (hasDiplo) { return Promise.reject('Already involved in diplomacy with target alliance.'); }

          return AllianceDiplomacy.create({
            OriginPlayerId: socket.userData.playerId,
            OriginAllianceId: socket.userData.allianceId,
            TargetAllianceId: alliance.id,
            status: 'ongoing',
            type: 'war',
            data: {
              reason: payload.reason,
            }
          }, { transaction });
         })
        .then((diplomacy) => {
          diplo = diplomacy;

          return AllianceEvent.create({
            type: 'diplomacy',
            status: 'startWar',
            OriginAllianceId: socket.userData.allianceId,
            OriginPlayerId: socket.userData.playerId,
            TargetAllianceId: ally.id,
          }, { transaction })
        })
        .then((ev) => {
          const event: any = ev.get();
          const diplomacy: any = diplo.get();
          const originPlayer = { id: socket.userData.playerId, name: socket.userData.playerName };
          const originAlliance = { id: socket.userData.allianceId, name: socket.userData.allianceName };
          const targetAlliance = { id: ally.id, name: ally.name };

          diplomacy.OriginPlayer = originPlayer;
          diplomacy.OriginAlliance = originAlliance;
          diplomacy.TargetAlliance = targetAlliance;

          event.OriginPlayer = originPlayer;
          event.TargetAlliance = targetAlliance;
          event.OriginAlliance = originAlliance;

          socket.emit('alliance:declareWarSuccess', { event, data: diplomacy })
          socket.to(`alliance.${socket.userData.allianceId}`).emit('alliance:event', { event, data: diplomacy });
          socket.to(`alliance.${ally.id}`).emit('alliance:event', { event, data: diplomacy });
        })
    )
  }

  private static proposeDiplo(socket: UserSocket, targetName: string, type: string) {
    let ally: Alliance;
    let diplo: AllianceDiplomacy;
    const typeUpper = type.slice(0, 1).toUpperCase() + type.slice(1);

    return world.sequelize.transaction((transaction) =>
      Alliance.getAlliance({ name: targetName }, transaction)
        .then((alliance) => {
          if (!alliance || alliance.id === socket.userData.allianceId) { return Promise.reject('Wrong alliance.'); }
          ally = alliance;

          let hasDiplo = alliance.DiplomacyOrigin.some(({ TargetAllianceId }) => TargetAllianceId === socket.userData.allianceId);
          hasDiplo = hasDiplo || alliance.DiplomacyTarget.some(({ OriginAllianceId }) => OriginAllianceId === socket.userData.allianceId);
          if (hasDiplo) { return Promise.reject('Already involved in diplomacy with target alliance.'); }


          return AllianceDiplomacy.create({
            OriginPlayerId: socket.userData.playerId,
            OriginAllianceId: socket.userData.allianceId,
            TargetAllianceId: alliance.id,
            status: 'pending',
            type: type,
          }, { transaction });
         })
        .then((diplomacy) => {
          diplo = diplomacy;

          return AllianceEvent.create({
            type: 'diplomacy',
            status: `propose${typeUpper}`,
            OriginAllianceId: socket.userData.allianceId,
            OriginPlayerId: socket.userData.playerId,
            TargetAllianceId: ally.id,
          }, { transaction })
        })
        .then((ev) => {
          const event: any = ev.get();
          const diplomacy: any = diplo.get();
          const originPlayer = { id: socket.userData.playerId, name: socket.userData.playerName };
          const originAlliance = { id: socket.userData.allianceId, name: socket.userData.allianceName };
          const targetAlliance = { id: ally.id, name: ally.name };

          diplomacy.OriginPlayer = originPlayer;
          diplomacy.OriginAlliance = originAlliance;
          diplomacy.TargetAlliance = targetAlliance;

          event.OriginPlayer = originPlayer;
          event.TargetAlliance = targetAlliance;
          event.OriginAlliance = originAlliance;

          socket.emit(`alliance:propose${typeUpper}Success`, { event, data: diplomacy })
          socket.to(`alliance.${socket.userData.allianceId}`).emit('alliance:event', { event, data: diplomacy });
          socket.to(`alliance.${ally.id}`).emit('alliance:event', { event, data: diplomacy });
        })
    )
  }

  private static cancelDiplo(socket: UserSocket, targetId: number, type: string) {
    let ally;
    const typeUpper = type.slice(0, 1).toUpperCase() + type.slice(1);

    return world.sequelize.transaction((transaction) =>
      AllianceDiplomacy.findById(targetId, {
        include: [{
          model: Alliance,
          as: 'TargetAlliance',
          attributes: ['id', 'name'],
        }],
        transaction,
      })
        .then((diplomacy) => {
          if (!diplomacy || diplomacy.OriginAllianceId !== socket.userData.allianceId) {
            return Promise.reject(`Can't cancel pending ${type}.`);
          }
          if (diplomacy.status !== 'pending') {
            return Promise.reject(`${typeUpper} is already active.`);
          }
          ally = diplomacy.TargetAlliance;

          return diplomacy.destroy({ transaction });
         })
        .then(() => AllianceEvent.create({
            type: 'diplomacy',
            status: `cancel${typeUpper}`,
            OriginAllianceId: socket.userData.allianceId,
            OriginPlayerId: socket.userData.playerId,
            TargetAllianceId: ally.id,
          }, { transaction })
        )
        .then((ev) => {
          const event: any = ev.get();
          const originPlayer = { id: socket.userData.playerId, name: socket.userData.playerName };
          const originAlliance = { id: socket.userData.allianceId, name: socket.userData.allianceName };
          const targetAlliance = { id: ally.id, name: ally.name };

          event.OriginPlayer = originPlayer;
          event.TargetAlliance = targetAlliance;
          event.OriginAlliance = originAlliance;

          socket.emit(`alliance:cancel${typeUpper}Success`, { event, data: targetId })
          socket.to(`alliance.${socket.userData.allianceId}`).emit('alliance:event', { event, data: targetId });
          socket.to(`alliance.${ally.id}`).emit('alliance:event', { event, data: targetId });
        })
    )
  }

  private static rejectDiplo(socket: UserSocket, targetId: number, type: string) {
    let ally;
    const typeUpper = type.slice(0, 1).toUpperCase() + type.slice(1);

    return world.sequelize.transaction((transaction) =>
      AllianceDiplomacy.findById(targetId, {
        include: [{
          model: Alliance,
          as: 'OriginAlliance',
          attributes: ['id', 'name'],
        }],
        transaction,
      })
        .then((diplomacy) => {
          if (!diplomacy || diplomacy.TargetAllianceId !== socket.userData.allianceId) {
            return Promise.reject(`Can't reject ${type}.`);
          }
          if (diplomacy.status !== 'pending') {
            return Promise.reject(`${typeUpper} is already active.`);
          }
          ally = diplomacy.OriginAlliance;

          return diplomacy.destroy({ transaction });
         })
        .then(() => AllianceEvent.create({
            type: 'diplomacy',
            status: `reject${typeUpper}`,
            OriginAllianceId: socket.userData.allianceId,
            OriginPlayerId: socket.userData.playerId,
            TargetAllianceId: ally.id,
          }, { transaction })
        )
        .then((ev) => {
          const event: any = ev.get();
          const originPlayer = { id: socket.userData.playerId, name: socket.userData.playerName };
          const originAlliance = { id: socket.userData.allianceId, name: socket.userData.allianceName };
          const targetAlliance = { id: ally.id, name: ally.name };

          event.OriginPlayer = originPlayer;
          event.TargetAlliance = targetAlliance;
          event.OriginAlliance = originAlliance;

          socket.emit(`alliance:reject${typeUpper}Success`, { event, data: targetId })
          socket.to(`alliance.${socket.userData.allianceId}`).emit('alliance:event', { event, data: targetId });
          socket.to(`alliance.${ally.id}`).emit('alliance:event', { event, data: targetId });
        })
    )
  }

  private static acceptDiplo(socket: UserSocket, targetId: number, type: string) {
    let ally;
    const typeUpper = type.slice(0, 1).toUpperCase() + type.slice(1);

    return world.sequelize.transaction((transaction) =>
      AllianceDiplomacy.findById(targetId, {
        include: [{
          model: Alliance,
          as: 'OriginAlliance',
          attributes: ['id', 'name'],
        }],
        transaction,
      })
        .then((diplomacy) => {
          if (!diplomacy || diplomacy.TargetAllianceId !== socket.userData.allianceId) {
            return Promise.reject(`Can't accept ${type}.`);
          }
          if (diplomacy.status !== 'pending') {
             return Promise.reject(`${typeUpper} is already active.`);
          }
          ally = diplomacy.OriginAlliance;

          diplomacy.status = 'ongoing';
          return diplomacy.save({ transaction });
         })
        .then(() => AllianceEvent.create({
            type: 'diplomacy',
            status: `start${typeUpper}`,
            OriginAllianceId: socket.userData.allianceId,
            OriginPlayerId: socket.userData.playerId,
            TargetAllianceId: ally.id,
          }, { transaction })
        )
        .then((ev) => {
          const event: any = ev.get();
          const originPlayer = { id: socket.userData.playerId, name: socket.userData.playerName };
          const originAlliance = { id: socket.userData.allianceId, name: socket.userData.allianceName };
          const targetAlliance = { id: ally.id, name: ally.name };

          event.OriginPlayer = originPlayer;
          event.TargetAlliance = targetAlliance;
          event.OriginAlliance = originAlliance;

          socket.emit(`alliance:accept${typeUpper}Success`, { event, data: targetId })
          socket.to(`alliance.${socket.userData.allianceId}`).emit('alliance:event', { event, data: targetId });
          socket.to(`alliance.${ally.id}`).emit('alliance:event', { event, data: targetId });
        })
    )
  }

  private static endDiplo(socket: UserSocket, targetId: number, type: string) {
    let ally;
    const typeUpper = type.slice(0, 1).toUpperCase() + type.slice(1);

    return world.sequelize.transaction((transaction) =>
      AllianceDiplomacy.findById(targetId, {
        include: [{
          model: Alliance,
          as: 'TargetAlliance',
          attributes: ['id', 'name'],
        }, {
          model: Alliance,
          as: 'OriginAlliance',
          attributes: ['id', 'name'],
        }],
        transaction,
      })
        .then((diplomacy) => {
          if (!diplomacy || !(diplomacy.OriginAllianceId === socket.userData.allianceId || diplomacy.TargetAllianceId === socket.userData.allianceId)) {
            return Promise.reject(`Can't end ${type}.`);
          }
          if (diplomacy.status !== 'ongoing') {
             return Promise.reject(`${typeUpper} isn't active'.`);
          }
          ally = diplomacy.TargetAllianceId === socket.userData.allianceId ? diplomacy.OriginAlliance : diplomacy.TargetAlliance;

          return diplomacy.destroy({ transaction });
         })
        .then(() => AllianceEvent.create({
          type: 'diplomacy',
          status: `end${typeUpper}`,
          OriginAllianceId: socket.userData.allianceId,
          OriginPlayerId: socket.userData.playerId,
          TargetAllianceId: ally.id,
        }, { transaction }))
        .then((ev) => {
          const event: any = ev.get();
          const originPlayer = { id: socket.userData.playerId, name: socket.userData.playerName };
          const originAlliance = { id: socket.userData.allianceId, name: socket.userData.allianceName };
          const targetAlliance = { id: ally.id, name: ally.name };

          event.OriginPlayer = originPlayer;
          event.TargetAlliance = targetAlliance;
          event.OriginAlliance = originAlliance;

          socket.emit(`alliance:end${typeUpper}Success`, { event, data: targetId });
          socket.to(`alliance.${socket.userData.allianceId}`).emit('alliance:event', { event, data: targetId });
          socket.to(`alliance.${ally.id}`).emit('alliance:event', { event, data: targetId });
        })
    )
  }

  private static updatePlayerRole(socket: UserSocket, payload: PlayerRolePayload) {
    const { playerId, roleId } = payload;
    const allianceId = socket.userData.allianceId;
    let ally;
    return world.sequelize.transaction((transaction) =>
      Alliance.getAlliance({
        id: allianceId,
      }, transaction)
        .then((alliance) => {
          if (!alliance || !this.hasItemById(alliance.Members, playerId) || !this.hasItemById(alliance.Roles, roleId)) {
            return Promise.reject('Can\'t change player role.');
          }
          ally = alliance;

          return Player.update({
            AllianceRoleId: roleId,
          }, {
            where: { id: playerId },
            transaction,
          });
        })
        .then(() => AllianceEvent.create({
          type: 'roles',
          status: 'updateMember',
          OriginPlayerId: socket.userData.playerId,
          TargetPlayerId: playerId,
          OriginAllianceId: socket.userData.allianceId,
        }, { transaction })),
    )
      .then((ev) => {
        const memberRole = ally.Roles.find(({ id }) => id === roleId);
        const event = ev.get();
        event.OriginPlayer = {
          id: socket.userData.playerId,
          name: socket.userData.playerName,
        };
        event.TargetPlayer = {
          id: playerId,
          name: ally.Members.find(({ id }) => id === playerId).name,
        };
        const data = { updatedMember: [{ id: playerId, role: memberRole  }] };
        const allianceRoom = `alliance.${allianceId}`;

        socket.emit('alliance:updateMemberRoleSuccess', { event, data });
        socket.to(allianceRoom).emit('alliance:event', { event, data });
        const room = io.sockets.adapter.rooms[`player.${playerId}`];
        if (room) {
          Object.keys(room.sockets).forEach((socketId: string) => {
            const client = io.sockets.connected[socketId] as UserSocket;
            client.userData = {
              ...client.userData,
              allianceRoleId: roleId,
              alliancePermissions: memberRole.permissions,
            };
          });
        }
      });
  }

  private static leaveAlliance(socket: UserSocket) {
    return world.sequelize.transaction((transaction) =>
      Player.update({
        AllianceId: null,
        AllianceRoleId: null,
      }, {
        where: {
          id: socket.userData.playerId,
        },
        transaction,
      }).then(() => AllianceEvent.create({
        type: 'membership',
        status: 'leave',
        OriginAllianceId: socket.userData.allianceId,
        OriginPlayerId: socket.userData.playerId,
      }, { transaction })),
    ).then((ev) => {
      const allianceId = socket.userData.allianceId;
      const event = ev.get();
      event.OriginPlayer = {
        id: socket.userData.playerId,
        name: socket.userData.playerName,
      };

      socket.userData = {
        ...socket.userData,
        allianceId: null,
        allianceName: null,
        allianceRoleId: null,
        alliancePermissions: null,
      };
      this.leaveAllianceRoom(socket, allianceId);
      socket.emit('alliance:leaveAllianceSuccess');
      io.sockets.in(`alliance.${allianceId}`).emit('alliance:event', { event, data: socket.userData.playerId });
    });
  }

  private static createForumCategory(socket: UserSocket, payload: ForumCategoryPayload) {
    return AllianceForumCategory.create({
      name: payload.name,
      description: payload.description,
      AllianceId: socket.userData.allianceId })
      .then((category) => {
        socket.emit('alliance:forumCategoryCreate', category);
      });
  }

  private static postMessage(socket: UserSocket, text: string) {
    return AllianceMessage.create({
      text,
      PlayerId: socket.userData.playerId,
      AllianceId: socket.userData.allianceId,
    })
      .then((allianceMessage) => {
        const message: any = allianceMessage.get();
        message.Player = { name: socket.userData.playerName };
        setTimeout(() => {

          socket.emit('chat:messageCreated', message);
          socket.broadcast.to(`alliance.${socket.userData.allianceId}`).emit('chat:newMessage', message);
        }, 5000);
      });
  }

  private static hasItemById(items: any[], id: number) {
    return items.some((item) => item.id === id);
  }

  private static permissionsChanged(oldPermissions: AlliancePermissions, newPermissions: AlliancePermissions) {
    const oldEntries = Object.entries(oldPermissions);
    const newEntries = Object.entries(newPermissions);
    return oldEntries.length === newEntries.length && Object.entries(oldPermissions).every(([name, value]) => newPermissions[name] === value);
  }
}
