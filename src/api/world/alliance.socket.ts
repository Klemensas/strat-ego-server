import { world } from '../../sqldb';
import { Player } from './Player.model';
import { Alliance } from './Alliance.model';

function joinAllianceRoom(socket) {
  if (socket.player && socket.player.Alliance) {
    socket.join(`alliance.${socket.player.Alliance.id}`);
    socket.log(`${socket.username} joined alliance ${socket.player.Alliance.name} room`);
  }
}

function createAlliance(data) {
  const targetName = data.name;
  Player.getPlayer(this.userId)
    .then((player) => {
      if (player.Alliance) {
        return Promise.reject('Can\'t create alliance.');
      }

      return world.sequelize.transaction((transaction) =>
        Alliance.create({
          name: targetName,
          roles: {},
        }, { transaction })
        .then((alliance) => {
          player.allianceRole = 'Owner';
          return player.save({ transaction })
            .then((updatedPlayer) => updatedPlayer.setAlliance(alliance, { transaction }));
        }),
      )
      .then(() => Player.getPlayer(this.userId))
      .then((updatedPlayer) => {
        this.emit('player', updatedPlayer);
      });
  });
}

function invitePlayer(data) {
  let invitingPlayer;
  const targetName = data.name;

  return Player.getPlayer(this.userId)
    .then((player) => {
      // TODO: add additional permission check
      if (!player.Alliance) {
        return Promise.reject('Can\'t invite player.');
      }
      invitingPlayer = player;
      return Player.findOne({ where: { name: targetName } });
    })
    .then((invitedPlayer) => {
      if (!invitedPlayer) {
        return Promise.reject('Target player not found.');
      }
      return invitedPlayer.addInvitation(invitingPlayer.Alliance);
    })
    // TODO: emit to alliance and target player if hes on
    // .then(() => Alliance.findById(invitingPlayer.Alliance.id))
    // .then((alliance) => )
    .then((invitation) => this.emit('alliance:invite', { invitation, deleted: false }));
}

export default (socket) => {
  joinAllianceRoom(socket);

  socket.on('alliance:create', createAlliance);
  socket.on('alliance:invite', invitePlayer);
  return socket;
};
