import { EventEmitter } from 'events';
import { transaction } from 'objection';

import { UserSocket, ErrorMessage } from '../../config/socket';
import { PlayerSocket } from './playerSocket';
import * as playerQueries from './playerQueries';
import * as cloudinary from '../../cloudinary';
import { ProfileService } from '../profile/profileService';

const transactionRollbackSpy = jest.fn();
const transactionCommitSpy = jest.fn();
const transactionMock = { rollback: transactionRollbackSpy, commit: transactionCommitSpy };
let socket: UserSocket;
const initialSocketData = {
  playerId: 5,
  test: true,
};
beforeEach(() => {
  socket = new EventEmitter() as UserSocket;
  socket.handleError = jest.fn().mockImplementation(() => null);
  socket.join = jest.fn().mockImplementation(() => null);
  socket.userData = { ...initialSocketData } as any;
  jest.spyOn(socket, 'emit');
});

describe('onConnect', () => {
  const playerData = {
    id: 4,
    name: 'testerino',
    allianceId: 12,
    allianceRoleId: null,
    towns: [],
  };

  beforeEach(() => {
    jest.spyOn(PlayerSocket, 'getOrCreatePlayer').mockImplementationOnce(() => playerData);
  });

  it('should register events', async () => {
    const socketEvents = [
      'player:restart',
      'player:updateProfile',
      'player:removeAvatar',
      'player:progressTutorial',
    ];
    expect(socket.eventNames()).toHaveLength(0);
    await PlayerSocket.onConnect(socket);
    expect(socket.eventNames()).toEqual(socketEvents);

  });
  it('should set player data and return it', async () => {
    const result = await PlayerSocket.onConnect(socket);
    expect(PlayerSocket.getOrCreatePlayer).toHaveBeenCalledWith(socket);
    expect(socket.join).toHaveBeenCalledWith(`player.${playerData.id}`);
    expect(socket.userData).toEqual({
      ...initialSocketData,
      playerId: playerData.id,
      playerName: playerData.name,
      allianceId: playerData.allianceId,
      allianceRoleId: playerData.allianceRoleId,
    });
    expect(result).toEqual(playerData);
  });

  describe('events', () => {
    beforeEach(() => {
      jest.spyOn(PlayerSocket, 'getOrCreatePlayer').mockImplementationOnce(() => ({ towns: [] }));
      PlayerSocket.onConnect(socket);
    });

    it('should call restart on restart emit', () => {
      jest.spyOn(PlayerSocket, 'restart').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(PlayerSocket.restart).not.toHaveBeenCalled();

      socket.emit('player:restart');
      expect(PlayerSocket.restart).toHaveBeenCalledWith(socket);
    });

    it('should call restart on restart emit', () => {
      jest.spyOn(PlayerSocket, 'restart').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(PlayerSocket.restart).not.toHaveBeenCalled();

      socket.emit('player:restart');
      expect(PlayerSocket.restart).toHaveBeenCalledWith(socket);
    });

    it('should call updateProfile on updateProfile emit', () => {
      jest.spyOn(PlayerSocket, 'updateProfile').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(PlayerSocket.updateProfile).not.toHaveBeenCalled();

      const payload = { description: 'test' };
      socket.emit('player:updateProfile', payload);
      expect(PlayerSocket.updateProfile).toHaveBeenCalledWith(socket, payload);
    });

    it('should call removeAvatar on removeAvatar emit', () => {
      jest.spyOn(PlayerSocket, 'removeAvatar').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(PlayerSocket.removeAvatar).not.toHaveBeenCalled();

      socket.emit('player:removeAvatar');
      expect(PlayerSocket.removeAvatar).toHaveBeenCalledWith(socket);
    });

    it('should call progressTutorial on progressTutorial emit', () => {
      jest.spyOn(PlayerSocket, 'progressTutorial').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(PlayerSocket.progressTutorial).not.toHaveBeenCalled();

      socket.emit('player:progressTutorial');
      expect(PlayerSocket.progressTutorial).toHaveBeenCalledWith(socket);
    });
  });
});

describe('updateProfile', () => {
  let getPlayerSpy;
  let updatePlayerSpy;
  let cloudinaryCheckSpy;
  let cloudinaryRemoveSpy;
  beforeEach(() => {
    getPlayerSpy = jest.spyOn(playerQueries, 'getPlayer');
    updatePlayerSpy = jest.spyOn(playerQueries, 'updatePlayer');
    cloudinaryCheckSpy = jest.spyOn(cloudinary, 'isCloudinaryImage');
    cloudinaryRemoveSpy = jest.spyOn(cloudinary, 'cloudinaryDelete');
    jest.spyOn(transaction, 'start').mockImplementationOnce(() => (transactionMock));
    jest.spyOn(ProfileService, 'updatePlayerProfile').mockImplementationOnce(() => null);
  });

  describe('on error', () => {
    it('should rollback transaction and call socket error handler', async () => {
      const error = 'dead';
      getPlayerSpy.mockImplementationOnce(() => { throw error; });

      await PlayerSocket.updateProfile(socket, {});
      expect(transactionRollbackSpy).toHaveBeenCalled();
      expect(socket.handleError).toHaveBeenCalledWith(error, 'updateProfile', `player:updateProfileFail`);
    });

    it('should throw on invalid avatarUrl', async () => {
      getPlayerSpy.mockImplementationOnce(() => ({}));
      cloudinaryCheckSpy.mockImplementationOnce(() => false);
      await PlayerSocket.updateProfile(socket, { avatarUrl: 'yes' });
      expect(socket.handleError).toHaveBeenCalledWith(new ErrorMessage('Invalid avatar'), 'updateProfile', `player:updateProfileFail`);
    });

    it('should throw on update player error', async () => {
      const error = 'dead';
      getPlayerSpy.mockImplementationOnce(() => ({}));
      cloudinaryCheckSpy.mockImplementationOnce(() => true);
      updatePlayerSpy.mockImplementationOnce(() => { throw error; });
      await PlayerSocket.updateProfile(socket, { avatarUrl: 'yes' });
      expect(socket.handleError).toHaveBeenCalledWith(error, 'updateProfile', `player:updateProfileFail`);
    });

    it('should throw on cloudinary delete error', async () => {
      const error = 'dead';
      getPlayerSpy.mockImplementationOnce(() => ({ avatarUrl: 'old' }));
      cloudinaryCheckSpy.mockImplementationOnce(() => true);
      updatePlayerSpy.mockImplementationOnce(() => null);
      cloudinaryRemoveSpy.mockImplementationOnce(() => { throw error; });
      await PlayerSocket.updateProfile(socket, { avatarUrl: 'yes' });
      expect(socket.handleError).toHaveBeenCalledWith(error, 'updateProfile', `player:updateProfileFail`);
    });
  });

  describe('on success', () => {
    const player = {
      id: 1,
      name: 'tester',
      description: 'test',
      avatarUrl: 'defaultUrl',
    };

    beforeEach(() => {
      cloudinaryCheckSpy.mockImplementationOnce(() => true);
      cloudinaryRemoveSpy.mockImplementationOnce(() => true);
      getPlayerSpy.mockImplementationOnce(() => Promise.resolve(player));
      updatePlayerSpy.mockImplementationOnce(() => Promise.resolve());
    });

    it('should emit to socket', async () => {
      const payload = { avatarUrl: 'yes', description: 'baba' };
      await PlayerSocket.updateProfile(socket, payload);

      expect(socket.emit).toHaveBeenCalledWith('player:updateProfileSuccess', payload);
    });
  });
});

describe('removeAvatar', () => {
  let getPlayerSpy;
  let updatePlayerSpy;
  let cloudinaryRemoveSpy;
  beforeEach(() => {
    getPlayerSpy = jest.spyOn(playerQueries, 'getPlayer');
    updatePlayerSpy = jest.spyOn(playerQueries, 'updatePlayer');
    cloudinaryRemoveSpy = jest.spyOn(cloudinary, 'cloudinaryDelete');
    jest.spyOn(transaction, 'start').mockImplementationOnce(() => (transactionMock));
    jest.spyOn(ProfileService, 'updatePlayerProfile').mockImplementationOnce(() => null);
  });

  describe('on error', () => {
    it('should rollback transaction and call socket error handler', async () => {
      const error = 'dead';
      getPlayerSpy.mockImplementationOnce(() => { throw error; });

      await PlayerSocket.removeAvatar(socket);
      expect(transactionRollbackSpy).toHaveBeenCalled();
      expect(socket.handleError).toHaveBeenCalledWith(error, 'removeAvatar', `player:removeAvatarFail`);
    });

    it('should throw on missing avatarUrl', async () => {
      getPlayerSpy.mockImplementationOnce(() => ({}));
      await PlayerSocket.removeAvatar(socket);
      expect(socket.handleError).toHaveBeenCalledWith(new ErrorMessage('No avatar present'), 'removeAvatar', `player:removeAvatarFail`);
    });

    it('should throw on cloudinary delete error', async () => {
      const error = 'dead';
      getPlayerSpy.mockImplementationOnce(() => ({ avatarUrl: 'old' }));
      updatePlayerSpy.mockImplementationOnce(() => null);
      cloudinaryRemoveSpy.mockImplementationOnce(() => { throw error; });
      await PlayerSocket.removeAvatar(socket);
      expect(socket.handleError).toHaveBeenCalledWith(error, 'removeAvatar', `player:removeAvatarFail`);
    });

    it('should throw on update player error', async () => {
      const error = 'dead';
      getPlayerSpy.mockImplementationOnce(() => ({ avatarUrl: 'any' }));
      updatePlayerSpy.mockImplementationOnce(() => { throw error; });
      cloudinaryRemoveSpy.mockImplementationOnce(() => null);
      await PlayerSocket.removeAvatar(socket);
      expect(socket.handleError).toHaveBeenCalledWith(error, 'removeAvatar', `player:removeAvatarFail`);
    });
  });

  describe('on success', () => {
    const player = {
      id: 1,
      name: 'tester',
      description: 'test',
      avatarUrl: 'defaultUrl',
    };

    beforeEach(() => {
      cloudinaryRemoveSpy.mockImplementationOnce(() => true);
      getPlayerSpy.mockImplementationOnce(() => Promise.resolve(player));
      updatePlayerSpy.mockImplementationOnce(() => Promise.resolve());
    });

    it('should emit to socket', async () => {
      await PlayerSocket.removeAvatar(socket);

      expect(socket.emit).toHaveBeenCalledWith('player:removeAvatarSuccess', { avatarUrl: null });
    });
  });
});

describe('progressTutorial', () => {
  let progressTutorialSpy;
  beforeEach(() => {
    progressTutorialSpy = jest.spyOn(playerQueries, 'progressTutorial');
  });

  describe('on error', () => {
    it('should throw', async () => {
      const error = 'progress error';
      progressTutorialSpy.mockImplementationOnce(() => { throw error; });

      await PlayerSocket.progressTutorial(socket);
      expect(socket.handleError).toHaveBeenCalledWith(error, 'progressTutorial', `player:progressTutorialFail`);
    });
  });

  describe('on success', () => {
    it('should emit socket event', async () => {
      progressTutorialSpy.mockImplementationOnce(() => null);

      await PlayerSocket.progressTutorial(socket);
      expect(socket.emit).toHaveBeenCalledWith('player:progressTutorialSuccess');
    });
  });
});
