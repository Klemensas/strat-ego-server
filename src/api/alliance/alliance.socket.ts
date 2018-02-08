import { world } from '../../sqldb';
import { Player } from '../world/player.model';
import { Alliance, allianceIncludes } from './alliance.model';
import { io } from '../../';
import { WhereOptions, Transaction } from 'sequelize';
import { AllianceRole } from './allianceRole.model';
import { UserSocket, AuthenticatedSocket } from 'config/socket';
import { AllianceForumCategory } from './allianceForumCategory.model';
import { AllianceMessage } from './allianceMessage.model';
import { AllianceEvent } from './allianceEvent.model';

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
    socket.on('alliance:createForumCategory', (payload: ForumCategoryPayload) => this.createForumCategory(socket, payload));
    socket.on('chat:postMessage', (message: string) => this.postMessage(socket, message));
  }

  static joinAllianceRoom(socket: UserSocket) {
    if (socket.userData.AllianceId) { socket.join(`alliance.${socket.userData.AllianceId}`); }
  }

  static leaveAllianceRoom(socket: AuthenticatedSocket, allianceId: number) {
    const room = `alliance.${allianceId}`;
    if (!!socket.rooms[room]) { socket.leave(room); }
  }

  private static createAlliance(socket: UserSocket, name: string) {
    if (socket.userData.AllianceId !== null) { return Promise.reject('Can\'t create alliance.'); }

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
            alliance.DefaultRoleId = alliance.Roles[1].id;
            return alliance.save({ transaction });
          })
          .then((alliance) => {
            player.AllianceId = alliance.id;
            player.AllianceRoleId = alliance.Roles[0].id;
            return player.save({ transaction });
          })
          .then(() => Alliance.getAlliance({ id: player.AllianceId }, transaction)),
        )
        .then((alliance) => {
          socket.userData = {
            ...socket.userData,
            AllianceId: player.AllianceId,
            AllianceRoleId: player.AllianceRoleId,
            AlliancePermissions: alliance.Roles[0].permissions,
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
      Alliance.getAlliance({ id: socket.userData.AllianceId }, transaction).then((alliance) => {
        // TODO: add additional permission check
        if (!alliance || !this.hasItemById(alliance.Members, socket.userData.playerId)) {
          return Promise.reject('Can\'t invite player.');
        }
        invitingAlliance = alliance;
        return Player.findOne({
          transaction,
          where: {
            name: targetName,
            // AllianceId: { $or: [{ $ne: invitingAlliance.id }, { $eq: null }] },
          },
          include: [{
            model: Alliance,
            as: 'Invitations',
          }],
        }).catch((p) => console.log('p err', targetName, p));
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
          InitiatingAllianceId: invitingAlliance.id,
          InitiatingPlayerId: socket.userData.playerId,
          TargetPlayerId: invitedPlayer.id,
        }, { transaction });
      }).then((ev) => {
        // TODO: Look into type fix
        // socket.emit('alliance', alliance);
        const invite = {
          id: createdInvite.PlayerId,
          name: targetName,
          AllianceInvitations: createdInvite,
        };
        const playerRoom = `player.${invitedPlayer.id}`;
        const event: any = ev.get();
        event.InitiatingPlayer = {
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
      Alliance.getAlliance({ id: socket.userData.AllianceId }, transaction).then((alliance) => {
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
        InitiatingAllianceId: targetAlliance.id,
        InitiatingPlayerId: socket.userData.playerId,
        TargetPlayerId: playerId,
      }, { transaction }))
      .then((ev) => {
        // const alliance: any = targetAlliance.get();
        // alliance.Invitations.splice(inviteIndex, 1);
        // socket.emit('alliance', alliance);

        const event: any = ev.get();
        event.InitiatingPlayer = {
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
        InitiatingPlayerId: socket.userData.playerId,
        // TODO: consider if this should use initiating alliance instead of target
        // if player is not a part
        InitiatingAllianceId: allianceId,
      } , { transaction }))
      .then((ev) => {
        socket.emit('alliance:rejectInviteSuccess', allianceId);

        const event: any = ev.get();
        event.InitiatingPlayer = {
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
        InitiatingPlayerId: targetPlayer.id,
        InitiatingAllianceId: allianceId,
      }, { transaction }))
      .then((ev) => {
        event = ev.get();
        event.InitiatingPlayer = {
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
          AllianceId: alliance.id,
          AllianceRoleId: alliance.DefaultRoleId,
          AlliancePermissions: alliance.DefaultRole.permissions,
        };
        this.joinAllianceRoom(socket);
      }),
    );
  }

  private static updateRoles(socket: UserSocket, payload: RoleUpdatePayload) {
    const { roles, newRoles } = payload;
    return world.sequelize.transaction((transaction) =>
      Alliance.getAlliance({ id: socket.userData.AllianceId }, transaction).then((alliance) => {
        if (!alliance) { return Promise.reject('Wrong alliance.'); }

        const actions = [];
        if (newRoles.length) {
          const rolesToCreate = newRoles.map(({ name, permissions }) => ({
            name,
            permissions,
            AllianceId: alliance.id,
          }));
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
      }),
    )
      .then(() => Alliance.getAlliance({ id: socket.userData.AllianceId }))
      .then((alliance) => io.sockets.in(`alliance.${alliance.id}`).emit('alliance', alliance));
  }

  private static removeRole(socket: UserSocket, roleId: number) {
    return world.sequelize.transaction((transaction) =>
      Alliance.getAlliance({ id: socket.userData.AllianceId }, transaction)
        .then((alliance) => {
          if (!alliance) { return Promise.reject('Wrong alliance.'); }

          const target = alliance.Roles.find((role) => role.id === roleId);
          if (!target) { return Promise.reject('Wrong role'); }

          return Player.update(
            { AllianceRoleId: alliance.DefaultRoleId },
            { where: { AllianceRoleId: roleId, AllianceId: alliance.id }, transaction },
          );
        })
        .then(() => AllianceRole.destroy({ where: { id: roleId }, transaction })),
    )
      .then(() => Alliance.getAlliance({ id: socket.userData.AllianceId }))
      .then((alliance) => io.sockets.in(`alliance.${alliance.id}`).emit('alliance', alliance));
  }

  private static removeMember(socket: UserSocket, playerId: number) {
    return world.sequelize.transaction((transaction) =>
      Alliance.getAlliance({ id: socket.userData.AllianceId }, transaction)
        .then((alliance) => {
          if (!alliance) { return Promise.reject('Can\t remove member.'); }

          return Player.update({
            AllianceId: null,
            AllianceRoleId: null,
          }, {
            where: {
              id: playerId,
              AllianceId: socket.userData.AllianceId,
            },
            transaction,
          });
        })
        .then(() => AllianceEvent.create({
          type: 'membership',
          status: 'remove',
          InitiatingPlayerId: socket.userData.playerId,
          TargetPlayerId: playerId,
          InitiatingAllianceId: socket.userData.AllianceId,
        }, { transaction })),
    )
      .then((ev: AllianceEvent) => {
        const playerRoom = `player.${playerId}`;
        let playerName;
        Object.keys(io.sockets.adapter.rooms[playerRoom].sockets).forEach((socketId: string) => {
          const client = io.sockets.connected[socketId] as UserSocket;
          client.userData = {
            ...client.userData,
            AllianceId: null,
            AllianceRoleId: null,
            AlliancePermissions: null,
          };
          playerName = client.userData.playerName;
          this.leaveAllianceRoom(client, socket.userData.AllianceId);
        });

        const event: any = ev.get();
        event.InitiatingPlayer = {
          id: socket.userData.playerId,
          name: socket.userData.playerName,
        };
        event.TargetPlayer = {
          id: playerId,
          name: playerName,
        };
        socket.emit(`alliance:removeMemberSuccess`, { event, data: playerId });
        io.sockets.in(playerRoom).emit('alliance:removed');
        socket.to(`alliance.${socket.userData.AllianceId}`).emit('alliance:event', { event, data: playerId });
    });
  }

  private static destroyAlliance(socket: UserSocket) {
    const allianceId = socket.userData.AllianceId;
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
          AllianceId: null,
          AllianceRoleId: null,
          AlliancePermissions: null,
        };
        client.leave(room);
      });
    });
  }

  private static updatePlayerRole(socket: UserSocket, payload: PlayerRolePayload) {
    const { playerId, roleId } = payload;
    const allianceId = socket.userData.AllianceId;
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
        }),
    )
      .then(() => {
        const room = `alliance.${allianceId}`;
        const member = ally.Members.find(({ id }) => id === playerId).get();
        member.AllianceRole = ally.Roles.find(({ id }) => id === roleId);
        io.sockets.in(room).emit('alliance:memberUpdate', member);
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
      // }).then(() => Alliance.getAlliance({ id: socket.userData.AllianceId }, transaction)),
      }).then(() => AllianceEvent.create({
        type: 'membership',
        status: 'leave',
        InitiatingAllianceId: socket.userData.AllianceId,
        InitiatingPlayerId: socket.userData.playerId,
      }, { transaction })),
    ).then((ev) => {
      const allianceId = socket.userData.AllianceId;
      const event = ev.get();
      event.InitiatingPlayer = {
        id: socket.userData.playerId,
        name: socket.userData.playerName,
      };

      socket.userData = {
        ...socket.userData,
        AllianceId: null,
        AllianceRoleId: null,
        AlliancePermissions: null,
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
      AllianceId: socket.userData.AllianceId })
      .then((category) => {
        socket.emit('alliance:forumCategoryCreate', category);
      });
  }

  private static postMessage(socket: UserSocket, text: string) {
    return AllianceMessage.create({
      text,
      PlayerId: socket.userData.playerId,
      AllianceId: socket.userData.AllianceId,
    })
      .then((allianceMessage) => {
        const message: any = allianceMessage.get();
        message.Player = { name: socket.userData.playerName };
        setTimeout(() => {

          socket.emit('chat:messageCreated', message);
          socket.broadcast.to(`alliance.${socket.userData.AllianceId}`).emit('chat:newMessage', message);
        }, 5000);
      });
  }

  private static hasItemById(items: any[], id: number) {
    return items.some((item) => item.id === id);
  }
}
