import { EventEmitter } from 'events';
import { transaction } from 'objection';
import * as http from 'http';

import { UserSocket, ErrorMessage, setupIo } from '../../config/socket';
import { AllianceSocket } from './allianceSocket';
import { PlayerRolePayload, RoleUpdatePayload, WarDeclarationPayload, DiplomacyType, MessagePayload, AlliancePermissions } from 'strat-ego-common';
import * as allianceQueries from './allianceQueries';
import * as cloudinary from '../../cloudinary';
import { worldData } from '../world/worldData';

const transactionRollbackSpy = jest.fn();
const transactionCommitSpy = jest.fn();
const transactionMock = { rollback: transactionRollbackSpy, commit: transactionCommitSpy };

let socket: UserSocket;
beforeEach(() => {
  socket = new EventEmitter() as UserSocket;
  socket.handleError = jest.fn().mockImplementation(() => null);
  socket.join = jest.fn().mockImplementation(() => null);
  socket.userData = {};
  jest.spyOn(socket, 'emit');
});

describe('onConnect', () => {
  const socketEvents = [
    'alliance:create',
    'alliance:createInvite',
    'alliance:cancelInvite',
    'alliance:acceptInvite',
    'alliance:rejectInvite',
    'alliance:updateMemberRole',
    'alliance:updateRoles',
    'alliance:removeRole',
    'alliance:removeMember',
    'alliance:leave',

    'alliance:destroy',
    'alliance:loadProfile',
    'alliance:updateProfile',
    'alliance:removeAvatar',

    'alliance:declareWar',
    'alliance:proposeAlliance',
    'alliance:proposeNap',
    'alliance:cancelAlliance',
    'alliance:cancelNap',
    'alliance:rejectAlliance',
    'alliance:rejectNap',
    'alliance:acceptAlliance',
    'alliance:acceptNap',
    'alliance:endAlliance',
    'alliance:endNap',

    'chat:postMessage',
  ];

  it('should register events', () => {
    jest.spyOn(AllianceSocket, 'joinAllianceRoom').mockImplementationOnce(() => null);
    expect(socket.eventNames()).toHaveLength(0);
    AllianceSocket.onConnect(socket);
    expect(AllianceSocket.joinAllianceRoom).toHaveBeenCalledWith(socket);
    expect(socket.eventNames()).toEqual(socketEvents);
  });

  describe('events', () => {
    beforeEach(() => {
      jest.spyOn(AllianceSocket, 'joinAllianceRoom').mockImplementationOnce(() => null);
      AllianceSocket.onConnect(socket);
    });

    it('should call creatAlliance on create emit', () => {
      jest.spyOn(AllianceSocket, 'createAlliance').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.createAlliance).not.toHaveBeenCalled();

      const payload = 'test';
      socket.emit('alliance:create', payload);
      expect(AllianceSocket.createAlliance).toHaveBeenCalledWith(socket, payload);
    });

    it('should call createInvite on createInvite emit', () => {
      jest.spyOn(AllianceSocket, 'createInvite').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.createInvite).not.toHaveBeenCalled();

      const payload = 'testPlayer';
      socket.emit('alliance:createInvite', payload);
      expect(AllianceSocket.createInvite).toHaveBeenCalledWith(socket, payload);
    });

    it('should call cancelInvite on cancelInvite emit', () => {
      jest.spyOn(AllianceSocket, 'cancelInvite').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.cancelInvite).not.toHaveBeenCalled();

      const payload = 2;
      socket.emit('alliance:cancelInvite', payload);
      expect(AllianceSocket.cancelInvite).toHaveBeenCalledWith(socket, payload);
    });

    it('should call acceptInvite on acceptInvite emit', () => {
      jest.spyOn(AllianceSocket, 'acceptInvite').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.acceptInvite).not.toHaveBeenCalled();

      const payload = 2;
      socket.emit('alliance:acceptInvite', payload);
      expect(AllianceSocket.acceptInvite).toHaveBeenCalledWith(socket, payload);
    });

    it('should call rejectInvite on rejectInvite emit', () => {
      jest.spyOn(AllianceSocket, 'rejectInvite').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.rejectInvite).not.toHaveBeenCalled();

      const payload = 2;
      socket.emit('alliance:rejectInvite', payload);
      expect(AllianceSocket.rejectInvite).toHaveBeenCalledWith(socket, payload);
    });

    it('should call updatePlayerRole on updateMemberRole emit', () => {
      jest.spyOn(AllianceSocket, 'updatePlayerRole').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.updatePlayerRole).not.toHaveBeenCalled();

      const payload: PlayerRolePayload = { playerId: 13, roleId: 4 };
      socket.emit('alliance:updateMemberRole', payload);
      expect(AllianceSocket.updatePlayerRole).toHaveBeenCalledWith(socket, payload);
    });

    it('should call updateRoles on updateRoles emit', () => {
      jest.spyOn(AllianceSocket, 'updateRoles').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.updateRoles).not.toHaveBeenCalled();

      const payload: RoleUpdatePayload = {
        roles: [{ id: 1 }],
        newRoles: [],
      };
      socket.emit('alliance:updateRoles', payload);
      expect(AllianceSocket.updateRoles).toHaveBeenCalledWith(socket, payload);
    });

    it('should call removeRole on removeRole emit', () => {
      jest.spyOn(AllianceSocket, 'removeRole').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.removeRole).not.toHaveBeenCalled();

      const payload = 2;
      socket.emit('alliance:removeRole', payload);
      expect(AllianceSocket.removeRole).toHaveBeenCalledWith(socket, payload);
    });

    it('should call removeMember on removeMember emit', () => {
      jest.spyOn(AllianceSocket, 'removeMember').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.removeMember).not.toHaveBeenCalled();

      const payload = 2;
      socket.emit('alliance:removeMember', payload);
      expect(AllianceSocket.removeMember).toHaveBeenCalledWith(socket, payload);
    });

    it('should call leaveAlliance on leave emit', () => {
      jest.spyOn(AllianceSocket, 'leaveAlliance').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.leaveAlliance).not.toHaveBeenCalled();

      socket.emit('alliance:leave');
      expect(AllianceSocket.leaveAlliance).toHaveBeenCalledWith(socket);
    });

    it('should call destroyAlliance on destroy emit', () => {
      jest.spyOn(AllianceSocket, 'destroyAlliance').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.destroyAlliance).not.toHaveBeenCalled();

      socket.emit('alliance:destroy');
      expect(AllianceSocket.destroyAlliance).toHaveBeenCalledWith(socket);
    });

    it('should call startWar on declareWar emit', () => {
      jest.spyOn(AllianceSocket, 'startWar').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.startWar).not.toHaveBeenCalled();

      const payload: WarDeclarationPayload = { targetName: 'test', reason: 'too real' };
      socket.emit('alliance:declareWar', payload);
      expect(AllianceSocket.startWar).toHaveBeenCalledWith(socket, payload);
    });

    it('should call proposeDiplo on proposeAlliance emit', () => {
      jest.spyOn(AllianceSocket, 'proposeDiplo').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.proposeDiplo).not.toHaveBeenCalled();

      const payload = 'testAlliance';
      socket.emit('alliance:proposeAlliance', payload);
      expect(AllianceSocket.proposeDiplo).toHaveBeenCalledWith(socket, payload, DiplomacyType.alliance);
    });

    it('should call proposeDiplo on proposeNap emit', () => {
      jest.spyOn(AllianceSocket, 'proposeDiplo').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.proposeDiplo).not.toHaveBeenCalled();

      const payload = 'testAlliance';
      socket.emit('alliance:proposeNap', payload);
      expect(AllianceSocket.proposeDiplo).toHaveBeenCalledWith(socket, payload, DiplomacyType.nap);
    });

    it('should call cancelDiplo on cancelAlliance emit', () => {
      jest.spyOn(AllianceSocket, 'cancelDiplo').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.cancelDiplo).not.toHaveBeenCalled();

      const payload = 2;
      socket.emit('alliance:cancelAlliance', payload);
      expect(AllianceSocket.cancelDiplo).toHaveBeenCalledWith(socket, payload, DiplomacyType.alliance);
    });

    it('should call cancelDiplo on cancelNap emit', () => {
      jest.spyOn(AllianceSocket, 'cancelDiplo').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.cancelDiplo).not.toHaveBeenCalled();

      const payload = 2;
      socket.emit('alliance:cancelNap', payload);
      expect(AllianceSocket.cancelDiplo).toHaveBeenCalledWith(socket, payload, DiplomacyType.nap);
    });

    it('should call rejectDiplo on rejectAlliance emit', () => {
      jest.spyOn(AllianceSocket, 'rejectDiplo').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.rejectDiplo).not.toHaveBeenCalled();

      const payload = 2;
      socket.emit('alliance:rejectAlliance', payload);
      expect(AllianceSocket.rejectDiplo).toHaveBeenCalledWith(socket, payload, DiplomacyType.alliance);
    });

    it('should call rejectDiplo on rejectNap emit', () => {
      jest.spyOn(AllianceSocket, 'rejectDiplo').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.rejectDiplo).not.toHaveBeenCalled();

      const payload = 2;
      socket.emit('alliance:rejectNap', payload);
      expect(AllianceSocket.rejectDiplo).toHaveBeenCalledWith(socket, payload, DiplomacyType.nap);
    });

    it('should call acceptDiplo on acceptAlliance emit', () => {
      jest.spyOn(AllianceSocket, 'acceptDiplo').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.acceptDiplo).not.toHaveBeenCalled();

      const payload = 2;
      socket.emit('alliance:acceptAlliance', payload);
      expect(AllianceSocket.acceptDiplo).toHaveBeenCalledWith(socket, payload, DiplomacyType.alliance);
    });

    it('should call acceptDiplo on acceptNap emit', () => {
      jest.spyOn(AllianceSocket, 'acceptDiplo').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.acceptDiplo).not.toHaveBeenCalled();

      const payload = 2;
      socket.emit('alliance:acceptNap', payload);
      expect(AllianceSocket.acceptDiplo).toHaveBeenCalledWith(socket, payload, DiplomacyType.nap);
    });

    it('should call endDiplo on endAlliance emit', () => {
      jest.spyOn(AllianceSocket, 'endDiplo').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.endDiplo).not.toHaveBeenCalled();

      const payload = 2;
      socket.emit('alliance:endAlliance', payload);
      expect(AllianceSocket.endDiplo).toHaveBeenCalledWith(socket, payload, DiplomacyType.alliance);
    });

    it('should call endDiplo on endNap emit', () => {
      jest.spyOn(AllianceSocket, 'endDiplo').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.endDiplo).not.toHaveBeenCalled();

      const payload = 2;
      socket.emit('alliance:endNap', payload);
      expect(AllianceSocket.endDiplo).toHaveBeenCalledWith(socket, payload, DiplomacyType.nap);
    });

    it('should call loadProfile on loadProfile emit', () => {
      jest.spyOn(AllianceSocket, 'loadProfile').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.loadProfile).not.toHaveBeenCalled();

      const payload = 4;
      socket.emit('alliance:loadProfile', payload);
      expect(AllianceSocket.loadProfile).toHaveBeenCalledWith(socket, payload);
    });

    it('should call updateProfile on updateProfile emit', () => {
      jest.spyOn(AllianceSocket, 'updateProfile').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.updateProfile).not.toHaveBeenCalled();

      const payload = { description: 'test' };
      socket.emit('alliance:updateProfile', payload);
      expect(AllianceSocket.updateProfile).toHaveBeenCalledWith(socket, payload);
    });

    it('should call removeAvatar on removeAvatar emit', () => {
      jest.spyOn(AllianceSocket, 'removeAvatar').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.removeAvatar).not.toHaveBeenCalled();

      socket.emit('alliance:removeAvatar');
      expect(AllianceSocket.removeAvatar).toHaveBeenCalledWith(socket);
    });

    it('should call postMessage on postMessage emit', () => {
      jest.spyOn(AllianceSocket, 'postMessage').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.postMessage).not.toHaveBeenCalled();

      const payload: MessagePayload = { text: 'test message', messageStamp: 2 };
      socket.emit('chat:postMessage', payload);
      expect(AllianceSocket.postMessage).toHaveBeenCalledWith(socket, payload);
    });
  });
});

describe('joinAlliancRoom', () => {
  it('should call join if user is in an alliance', () => {
    const userAlliance = 12;
    socket.userData.allianceId = userAlliance;
    AllianceSocket.joinAllianceRoom(socket);
    expect(socket.join).toHaveBeenCalledWith(`alliance.${userAlliance}`);
  });
  it('should not call join if user isn\'t in an alliance', () => {
    expect(socket.join).not.toHaveBeenCalled();
  });
});

describe('leavAlliance', () => {
  let getAllianceSpy;
  let leaveAllianceSpy;

  beforeEach(() => {
    getAllianceSpy = jest.spyOn(allianceQueries, 'getAllianceWithMembersRoles');
    leaveAllianceSpy = jest.spyOn(allianceQueries, 'leaveAlliance');
    jest.spyOn(transaction, 'start').mockImplementationOnce(() => (transactionMock));
  });

  describe('on error', () => {
    it('should rollback transaction and call socket error handler', async () => {
      const error = 'dead';
      getAllianceSpy.mockImplementationOnce(() => { throw error; });

      await AllianceSocket.leaveAlliance(socket);
      expect(transactionRollbackSpy).toHaveBeenCalled();
      expect(socket.handleError).toHaveBeenCalledWith(error, 'leaveAlliance', `alliance:leaveAllianceFail`);
    });

    it('should throw on missing alliance', async () => {
      getAllianceSpy.mockImplementationOnce(() => Promise.resolve(undefined));
      await AllianceSocket.leaveAlliance(socket);
      expect(socket.handleError).toHaveBeenCalledWith(new ErrorMessage('Wrong alliance'), 'leaveAlliance', `alliance:leaveAllianceFail`);
    });

    it('should throw on masterRole match', async () => {
      const masterRoleId = 12;
      socket.userData.allianceRoleId = masterRoleId;
      getAllianceSpy.mockImplementationOnce(() => Promise.resolve({ masterRoleId }));
      await AllianceSocket.leaveAlliance(socket);
      expect(socket.handleError).toHaveBeenCalledWith(new ErrorMessage('Owner can\'t leave alliance'), 'leaveAlliance', `alliance:leaveAllianceFail`);
    });
  });

  describe('on success', () => {
    const playerId = 1;
    const allianceId = 4;
    beforeEach(() => {
      socket.userData.playerId = playerId;
      socket.userData.allianceRoleId = 12;
      getAllianceSpy.mockImplementationOnce(() => Promise.resolve({
        id: allianceId,
        masterRoleId: 13,
      }));
      jest.spyOn(AllianceSocket, 'leaveAllianceRoom').mockImplementationOnce(() => null);
      jest.spyOn(worldData.mapManager, 'setTownAlliance').mockImplementationOnce(() => null);

      leaveAllianceSpy.mockImplementationOnce(() => Promise.resolve({}));
    });

    it('should call related functions query', async () => {
      await AllianceSocket.leaveAlliance(socket);
      expect(leaveAllianceSpy).toHaveBeenCalledWith(playerId, allianceId, transactionMock);
      expect(AllianceSocket.leaveAllianceRoom).toHaveBeenCalled();
      expect(worldData.mapManager.setTownAlliance).toHaveBeenCalled();
    });

    it('should emit to socket', async () => {
      const emitSpy = jest.fn();
      const server = http.createServer();
      const io = setupIo(server);
      io.sockets = {
        in: jest.fn().mockImplementationOnce(() => ({ emit: emitSpy })),
      } as any;
      // Object.assign(io, {
      //   sockets: {
      //     in: jest.fn().mockImplementationOnce(() => ({ emit: emitSpy })),
      //   },
      // });
      // io = {
      // } as any,
      await AllianceSocket.leaveAlliance(socket);
      expect(socket.emit).toHaveBeenCalledWith('alliance:leaveAllianceSuccess');
      expect(emitSpy).toHaveBeenCalledWith('alliance:event', {
        event: {
          originPlayer: { id: socket.userData.playerId, name: socket.userData.playerName },
        },
        data: socket.userData.playerId,
      });
    });
  });
});

describe('loadProfile', () => {
  let getAllianceProfileSpy;
  beforeEach(() => {
    getAllianceProfileSpy = jest.spyOn(allianceQueries, 'getAllianceProfile');
    jest.spyOn(transaction, 'start').mockImplementationOnce(() => (transactionMock));
  });

  describe('on error', () => {
    it('should rollback transaction and call socket error handler', async () => {
      const error = 'dead';
      getAllianceProfileSpy.mockImplementationOnce(() => { throw error; });

      await AllianceSocket.loadProfile(socket, 1);
      expect(transactionRollbackSpy).toHaveBeenCalled();
      expect(socket.handleError).toHaveBeenCalledWith(error, 'loadProfile', `alliance:loadProfileFail`);
    });

    it('should throw on missing alliance', async () => {
      getAllianceProfileSpy.mockImplementationOnce(() => Promise.resolve(undefined));
      await AllianceSocket.loadProfile(socket, 1);
      expect(socket.handleError).toHaveBeenCalledWith(new ErrorMessage('Wrong alliance'), 'loadProfile', `alliance:loadProfileFail`);
    });
  });

  describe('on success', () => {
    const alliance = {
      id: 1,
      name: 'tester',
    };

    beforeEach(() => {
      getAllianceProfileSpy.mockImplementationOnce(() => Promise.resolve(alliance));
    });

    it('should emit to socket', async () => {
      await AllianceSocket.loadProfile(socket, 1);
      expect(socket.emit).toHaveBeenCalledWith('alliance:loadProfileSuccess', alliance);
    });
  });
});

describe('updateProfile', () => {
  let getAllianceSpy;
  let updateAllianceSpy;
  let createEventSpy;
  let cloudinaryCheckSpy;
  let cloudinaryRemoveSpy;
  beforeEach(() => {
    getAllianceSpy = jest.spyOn(allianceQueries, 'getAlliance');
    updateAllianceSpy = jest.spyOn(allianceQueries, 'updateAlliance');
    createEventSpy = jest.spyOn(allianceQueries, 'createAllianceEvent');
    cloudinaryCheckSpy = jest.spyOn(cloudinary, 'isCloudinaryImage');
    cloudinaryRemoveSpy = jest.spyOn(cloudinary, 'cloudinaryDelete');
    jest.spyOn(transaction, 'start').mockImplementationOnce(() => (transactionMock));

    socket.userData.alliancePermissions = {
      editProfile: true,
    } as AlliancePermissions;
  });

  describe('on error', () => {
    it('should rollback transaction and call socket error handler', async () => {
      const error = 'dead';
      getAllianceSpy.mockImplementationOnce(() => { throw error; });

      await AllianceSocket.updateProfile(socket, {});
      expect(transactionRollbackSpy).toHaveBeenCalled();
      expect(socket.handleError).toHaveBeenCalledWith(error, 'updateProfile', `alliance:updateProfileFail`);
    });

    it('should throw on missing permissions', async () => {
      socket.userData.alliancePermissions.editProfile = false;
      await AllianceSocket.updateProfile(socket, {});
      expect(socket.handleError).toHaveBeenCalledWith(new ErrorMessage('Not permitted to do that'), 'updateProfile', `alliance:updateProfileFail`);
    });

    it('should throw on missing alliance', async () => {
      getAllianceSpy.mockImplementationOnce(() => undefined);
      await AllianceSocket.updateProfile(socket, {});
      expect(socket.handleError).toHaveBeenCalledWith(new ErrorMessage('Wrong alliance'), 'updateProfile', `alliance:updateProfileFail`);
    });

    it('should throw on invalid avatarUrl', async () => {
      getAllianceSpy.mockImplementationOnce(() => ({}));
      cloudinaryCheckSpy.mockImplementationOnce(() => false);
      await AllianceSocket.updateProfile(socket, { avatarUrl: 'yes' });
      expect(socket.handleError).toHaveBeenCalledWith(new ErrorMessage('Invalid avatar'), 'updateProfile', `alliance:updateProfileFail`);
    });

    it('should throw on update alliance error', async () => {
      const error = 'dead';
      getAllianceSpy.mockImplementationOnce(() => ({}));
      cloudinaryCheckSpy.mockImplementationOnce(() => true);
      updateAllianceSpy.mockImplementationOnce(() => { throw error; });
      await AllianceSocket.updateProfile(socket, { avatarUrl: 'yes' });
      expect(socket.handleError).toHaveBeenCalledWith(error, 'updateProfile', `alliance:updateProfileFail`);
    });

    it('should throw on create event error', async () => {
      const error = 'dead';
      getAllianceSpy.mockImplementationOnce(() => ({}));
      cloudinaryCheckSpy.mockImplementationOnce(() => true);
      updateAllianceSpy.mockImplementationOnce(() => null);
      createEventSpy.mockImplementationOnce(() => { throw error; });
      await AllianceSocket.updateProfile(socket, { avatarUrl: 'yes' });
      expect(socket.handleError).toHaveBeenCalledWith(error, 'updateProfile', `alliance:updateProfileFail`);
    });

    it('should throw on cloudinary delete error', async () => {
      const error = 'dead';
      getAllianceSpy.mockImplementationOnce(() => ({ avatarUrl: 'old' }));
      cloudinaryCheckSpy.mockImplementationOnce(() => true);
      updateAllianceSpy.mockImplementationOnce(() => null);
      createEventSpy.mockImplementationOnce(() => ({}));
      cloudinaryRemoveSpy.mockImplementationOnce(() => { throw error; });
      await AllianceSocket.updateProfile(socket, { avatarUrl: 'yes' });
      expect(socket.handleError).toHaveBeenCalledWith(error, 'updateProfile', `alliance:updateProfileFail`);
    });
  });

  describe('on success', () => {
    const alliance = {
      id: 1,
      name: 'tester',
      description: 'test',
      avatarUrl: 'defaultUrl',
    };
    const event = {
      id: 2,
    };

    beforeEach(() => {
      cloudinaryCheckSpy.mockImplementationOnce(() => true);
      cloudinaryRemoveSpy.mockImplementationOnce(() => true);
      getAllianceSpy.mockImplementationOnce(() => Promise.resolve(alliance));
      updateAllianceSpy.mockImplementationOnce(() => Promise.resolve());
      createEventSpy.mockImplementationOnce(() => Promise.resolve(event));
    });

    it('should emit to socket', async () => {
      const payload = { avatarUrl: 'yes', description: 'baba' };
      await AllianceSocket.updateProfile(socket, payload);

      expect(socket.emit).toHaveBeenCalledWith('alliance:updateProfileSuccess', { event, data: payload });
    });
  });
});

describe('removeAvatar', () => {
  let getAllianceSpy;
  let updateAllianceSpy;
  let createEventSpy;
  let cloudinaryRemoveSpy;
  beforeEach(() => {
    getAllianceSpy = jest.spyOn(allianceQueries, 'getAlliance');
    updateAllianceSpy = jest.spyOn(allianceQueries, 'updateAlliance');
    createEventSpy = jest.spyOn(allianceQueries, 'createAllianceEvent');
    cloudinaryRemoveSpy = jest.spyOn(cloudinary, 'cloudinaryDelete');
    jest.spyOn(transaction, 'start').mockImplementationOnce(() => (transactionMock));

    socket.userData.alliancePermissions = {
      editProfile: true,
    } as AlliancePermissions;
  });

  describe('on error', () => {
    it('should rollback transaction and call socket error handler', async () => {
      const error = 'dead';
      getAllianceSpy.mockImplementationOnce(() => { throw error; });

      await AllianceSocket.removeAvatar(socket);
      expect(transactionRollbackSpy).toHaveBeenCalled();
      expect(socket.handleError).toHaveBeenCalledWith(error, 'removeAvatar', `alliance:removeAvatarFail`);
    });

    it('should throw on missing permissions', async () => {
      socket.userData.alliancePermissions.editProfile = false;
      await AllianceSocket.removeAvatar(socket);
      expect(socket.handleError).toHaveBeenCalledWith(new ErrorMessage('Not permitted to do that'), 'removeAvatar', `alliance:removeAvatarFail`);
    });

    it('should throw on missing alliance', async () => {
      getAllianceSpy.mockImplementationOnce(() => undefined);
      await AllianceSocket.removeAvatar(socket);
      expect(socket.handleError).toHaveBeenCalledWith(new ErrorMessage('Wrong alliance'), 'removeAvatar', `alliance:removeAvatarFail`);
    });

    it('should throw on missing avatarUrl', async () => {
      getAllianceSpy.mockImplementationOnce(() => ({}));
      await AllianceSocket.removeAvatar(socket);
      expect(socket.handleError).toHaveBeenCalledWith(new ErrorMessage('No avatar present'), 'removeAvatar', `alliance:removeAvatarFail`);
    });

    it('should throw on cloudinary delete error', async () => {
      const error = 'dead';
      getAllianceSpy.mockImplementationOnce(() => ({ avatarUrl: 'old' }));
      updateAllianceSpy.mockImplementationOnce(() => null);
      createEventSpy.mockImplementationOnce(() => ({}));
      cloudinaryRemoveSpy.mockImplementationOnce(() => { throw error; });
      await AllianceSocket.removeAvatar(socket);
      expect(socket.handleError).toHaveBeenCalledWith(error, 'removeAvatar', `alliance:removeAvatarFail`);
    });

    it('should throw on update alliance error', async () => {
      const error = 'dead';
      getAllianceSpy.mockImplementationOnce(() => ({ avatarUrl: 'any' }));
      updateAllianceSpy.mockImplementationOnce(() => { throw error; });
      cloudinaryRemoveSpy.mockImplementationOnce(() => null);
      await AllianceSocket.removeAvatar(socket);
      expect(socket.handleError).toHaveBeenCalledWith(error, 'removeAvatar', `alliance:removeAvatarFail`);
    });

    it('should throw on create event error', async () => {
      const error = 'dead';
      getAllianceSpy.mockImplementationOnce(() => ({ avatarUrl: 'any' }));
      updateAllianceSpy.mockImplementationOnce(() => null);
      createEventSpy.mockImplementationOnce(() => { throw error; });
      cloudinaryRemoveSpy.mockImplementationOnce(() => null);
      await AllianceSocket.removeAvatar(socket);
      expect(socket.handleError).toHaveBeenCalledWith(error, 'removeAvatar', `alliance:removeAvatarFail`);
    });
  });

  describe('on success', () => {
    const alliance = {
      id: 1,
      name: 'tester',
      description: 'test',
      avatarUrl: 'defaultUrl',
    };
    const event = {
      id: 2,
    };

    beforeEach(() => {
      cloudinaryRemoveSpy.mockImplementationOnce(() => true);
      getAllianceSpy.mockImplementationOnce(() => Promise.resolve(alliance));
      updateAllianceSpy.mockImplementationOnce(() => Promise.resolve());
      createEventSpy.mockImplementationOnce(() => Promise.resolve(event));
    });

    it('should emit to socket', async () => {
      await AllianceSocket.removeAvatar(socket);

      expect(socket.emit).toHaveBeenCalledWith('alliance:removeAvatarSuccess', { event, data: { avatarUrl: null } });
    });
  });
});

describe('cleanSocketAlliance', () => {
  const socketData = {
    allianceId: 5,
    allianceName: 'test',
    allianceRoleId: 1,
    alliancePermissions: { 1: true },
  } as any;
  const nulledData = Object.keys(socketData).reduce((result, key) => ({ ...result, [key]: null }), {});

  it('should return nullified alliance data', () => {
    expect(AllianceSocket.cleanSocketAlliance(socketData)).toEqual(nulledData);
  });

  it('should preserve other data', () => {
    const additionalData = {
      name: 'test',
      userId: 1,
      date: Date.now(),
    };
    expect(AllianceSocket.cleanSocketAlliance({ ...socketData, ...additionalData })).toEqual({ ...nulledData, ...additionalData });
  });
});
