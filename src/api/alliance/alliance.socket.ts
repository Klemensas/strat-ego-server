import { world } from '../../sqldb';
import { Player } from '../world/player.model';
import { Alliance, allianceIncludes } from './alliance.model';
import { io } from '../../';
import { WhereOptions, Transaction } from 'sequelize';
import { AllianceRole } from './allianceRole.model';

// TODO: overiew permissions everywhere

function joinAllianceRoom(socket) {
  if (socket.player && socket.player.Alliance) {
    socket.join(`alliance.${socket.player.Alliance.id}`);
    socket.log(`${socket.username} joined alliance ${socket.player.Alliance.name} room`);
  }
}

function isMember(members, id) {
  return members.some((member) => member.id === id);
}

function createAlliance(data) {
  const targetName = data.name;

  return Player.getPlayer({ UserId: this.userId })
    .then((player) => {
      if (player.Alliance) {
        return Promise.reject('Can\'t create alliance.');
      }

      return world.sequelize.transaction((transaction) =>
        Alliance.create({
          name: targetName,
          Roles: [{
            name: 'Owner',
            permissions: {
              viewInvites: true,
              editInvites: true,
              viewManagement: true,
              manageMinorRoles: true,
              manageAllRoles: true,
              editProfile: true,
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
        }),
      )
      .then(() => Player.getPlayer({ UserId: this.userId }))
      .then((updatedPlayer) => {
        this.player = updatedPlayer;
        this.emit('player', updatedPlayer);
      });
  });
}

function invitePlayer(data) {
  let invitingAlliance: Alliance;
  let invitedPlayer: Player;
  const targetName = data.name;

  return world.sequelize.transaction((transaction) =>
    Alliance.getAlliance({ id: this.player.AllianceId }, transaction).then((alliance) => {
      // TODO: add additional permission check
      if (!alliance || !isMember(alliance.Members, this.player.id)) {
        return Promise.reject('Can\'t invite player.');
      }
      invitingAlliance = alliance;
      return Player.findOne({
        transaction,
        where: {
          name: targetName,
          AllianceId: { $or: [{ $ne: invitingAlliance.id }, { $eq: null }] },
        },
        include: [{
          model: Alliance,
          as: 'Invitations',
        }],
      });
    }).then((player) => {
      // TODO: look for certain if invite existance can't be checked in sql
      if (!player || player.Invitations.some((invite) => invite.id === invitingAlliance.id)) {
        return Promise.reject('Can\'t invite player.');
      }
      invitedPlayer = player;
      return invitingAlliance.addInvitation([player], { transaction });
    }).then((invite) => {
      const { id, name, createdAt } = invitedPlayer;
      const invitation = { id, name, createdAt, AllianceInvitations: invite[0][0] };
      const Invitations = [invitation, ...invitingAlliance.Invitations];
      // TODO: Look into type fix
      const alliance: any = invitingAlliance.get();
      alliance.Invitations = Invitations;
      this.emit('alliance', alliance);
    }),
  ).then(() => {
    const playerRoom = `player.${invitedPlayer.id}`;
    if (!io.sockets.adapter.rooms[playerRoom]) { return; }

    return Player.getPlayer({ id: invitedPlayer.id })
      .then((player) => io.sockets.in(playerRoom).emit('player', player));
  });
}

function cancelInvite(data) {
  let targetAlliance: Alliance;
  let inviteIndex;
  const targetPlayer: number = data.playerId;

  return world.sequelize.transaction((transaction) =>
    Alliance.getAlliance({ id: this.player.AllianceId }, transaction).then((alliance) => {
      // TODO: add additional permission check
      if (!alliance || !isMember(alliance.Members, this.player.id)) { return Promise.reject('Wrong alliance.'); }
      inviteIndex = alliance.Invitations.findIndex((invite) => invite.id === targetPlayer);
      if (inviteIndex === -1) { return Promise.reject('Wrong invitation.'); }

      targetAlliance = alliance;
      return alliance.removeInvitation(targetPlayer, { transaction });
    }).then(() => {
      const alliance: any = targetAlliance.get();
      alliance.Invitations.splice(inviteIndex, 1);
      this.emit('alliance', alliance);
    }),
  ).then(() => {
    const playerRoom = `player.${targetPlayer}`;
    if (!io.sockets.adapter.rooms[playerRoom]) { return; }

    return Player.getPlayer({ id: targetPlayer })
      .then((player) => io.sockets.in(playerRoom).emit('player', player));
  });
}

function rejectInvite(data) {
  let targetPlayer: Player;
  let inviteIndex;
  const targetAlliance: number = data.allianceId;

  return world.sequelize.transaction((transaction) =>
    Player.getPlayer({ id: this.player.id }, transaction).then((player) => {
      if (!player) { return Promise.reject('Wrong player.'); }
      inviteIndex = player.Invitations.find((invite) => invite.id === targetAlliance);
      if (inviteIndex === -1) { return Promise.reject('Wrong invitation.'); }

      targetPlayer = player;
      return player.removeInvitation(targetAlliance, { transaction });
    }).then(() => {
      const player: any = targetPlayer.get();
      player.Invitations.splice(inviteIndex, 1);
      this.emit('player', player);
    }),
  )
  .then(() => Alliance.getAlliance({ id: targetAlliance }))
  .then((alliance) => io.sockets.in(`alliance.${alliance.id}`).emit('alliance', alliance));
}

function acceptInvite(data) {
  let targetPlayer: Player;
  let inviteIndex;
  const targetAlliance: number = data.allianceId;

  return world.sequelize.transaction((transaction) =>
    Player.getPlayer({ id: this.player.id }, transaction).then((player) => {
      if (!player) { return Promise.reject('Wrong player.'); }
      inviteIndex = player.Invitations.find((invite) => invite.id === targetAlliance);
      if (inviteIndex === -1) { return Promise.reject('Wrong invitation.'); }

      // player.allianceRole = 'Member';
      targetPlayer = player;
      return player.removeInvitation(targetAlliance, { transaction });
    })
    .then(() => targetPlayer.setAlliance(targetAlliance, { transaction }))
    .then(() => targetPlayer.save({ transaction })),
  )
  .then(() => Alliance.getAlliance({ id: targetAlliance }))
  .then((alliance) => {
    const player: any = targetPlayer.get();
    player.Invitations.splice(inviteIndex, 1);
    player.AllianceId = alliance.id;
    player.Alliance = alliance;

    io.sockets.in(`alliance.${alliance.id}`).emit('alliance', alliance);
    this.emit('player', player);
    joinAllianceRoom(this);
  });
}

function updateRoles(data) {
  const { roles, newRoles } = data;
  return world.sequelize.transaction((transaction) =>
    Alliance.getAlliance({ id: this.player.AllianceId }, transaction).then((alliance) => {
      if (!alliance) { return Promise.reject('Wrong alliance.'); }

      const actions = [];
      if (newRoles.length) {
        const rolesToCreate = roles.map(({ name, permissions }) => ({ name, permissions, AllianceId: alliance.id }));
        actions.push(AllianceRole.create(rolesToCreate, { transaction }));
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
    .then(() => Alliance.getAlliance({ id: this.player.AllianceId }))
    .then((alliance) => io.sockets.in(`alliance.${alliance.id}`).emit('alliance', alliance));
}

function removeRole(data) {
  // const role = data;

  return world.sequelize.transaction((transaction) =>
    Alliance.getAlliance({ id: this.player.AllianceId }, transaction)
      .then((alliance) => {
        if (!alliance) { return Promise.reject('Wrong alliance.'); }

        const target = alliance.Roles.find((role) => role.id === data.id);
        if (!target) { return Promise.reject('Wrong role'); }

        return Player.update(
          { AllianceRoleId: alliance.DefaultRoleId },
          { where: { AllianceRoleId: data.id, AllianceId: alliance.id }, transaction },
        );
      })
      .then(() => AllianceRole.destroy({ where: { id: data.id }, transaction })),
  )
    .then(() => Alliance.getAlliance({ id: this.player.AllianceId }))
    .then((alliance) => io.sockets.in(`alliance.${alliance.id}`).emit('alliance', alliance));
}

function destroyAlliance() {
  const allianceId = this.player.AllianceId;
  return world.sequelize.transaction((transaction) =>
    AllianceRole.destroy({ where: { AllianceId: allianceId }, transaction })
      .then(() => Alliance.destroy({ where: { id: allianceId }, transaction })),
  )
  .then(() => {
    console.log('destroyed');
    const room = `alliance.${allianceId}`;
    io.sockets.in(room).emit('alliance:destroy');
    Object.values(io.sockets.in(room).sockets).forEach((socket) => socket.leave(room));
  })
  .catch((r) => console.log('crashed', r));
}

export default (socket) => {
  joinAllianceRoom(socket);

  socket.on('alliance:create', createAlliance);
  socket.on('alliance:invite', invitePlayer);
  socket.on('alliance:cancelInvite', cancelInvite);
  socket.on('alliance:acceptInvite', acceptInvite);
  socket.on('alliance:rejectInvite', rejectInvite);
  socket.on('alliance:updateRoles', updateRoles);
  socket.on('alliance:updateRoles', updateRoles);
  socket.on('alliance:removeRole', removeRole);
  socket.on('alliance:destroy', destroyAlliance);
  return socket;
};
