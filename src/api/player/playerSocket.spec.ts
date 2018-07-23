import { EventEmitter } from 'events';
import { transaction } from 'objection';

import { UserSocket, ErrorMessage } from '../../config/socket';
import { PlayerSocket } from './playerSocket';
import * as playerQueries from './playerQueries';
import * as cloudinary from '../../cloudinary';

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
    'player:restart',
    'player:loadProfile',
    'player:updateProfile',
    'player:removeAvatar',
    'player:progressTutorial',
  ];

  it('should register events', async () => {
    jest.spyOn(PlayerSocket, 'getOrCreatePlayer').mockImplementationOnce(() => ({ towns: [] }));
    expect(socket.eventNames()).toHaveLength(0);
    await PlayerSocket.onConnect(socket);
    expect(PlayerSocket.getOrCreatePlayer).toHaveBeenCalledWith(socket);
    expect(socket.eventNames()).toEqual(socketEvents);
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

    it('should call loadProfile on loadProfile emit', () => {
      jest.spyOn(PlayerSocket, 'loadProfile').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(PlayerSocket.loadProfile).not.toHaveBeenCalled();

      const payload = 2;
      socket.emit('player:loadProfile', payload);
      expect(PlayerSocket.loadProfile).toHaveBeenCalledWith(socket, payload);
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
  });
});

describe('loadProfile', () => {
  let getPlayerProfileSpy;
  beforeEach(() => {
    getPlayerProfileSpy = jest.spyOn(playerQueries, 'getPlayerProfile');
    jest.spyOn(transaction, 'start').mockImplementationOnce(() => (transactionMock));
  });

  describe('on error', () => {
    it('should call socket error handler', async () => {
      const error = 'dead';
      getPlayerProfileSpy.mockImplementationOnce(() => { throw error; });

      await PlayerSocket.loadProfile(socket, 1);
      expect(socket.handleError).toHaveBeenCalledWith(error, 'loadProfile', `player:loadProfileFail`);
    });

    it('should throw on missing player', async () => {
      getPlayerProfileSpy.mockImplementationOnce(() => Promise.resolve(undefined));
      await PlayerSocket.loadProfile(socket, 1);
      expect(socket.handleError).toHaveBeenCalledWith(new ErrorMessage('Wrong player'), 'loadProfile', `player:loadProfileFail`);
    });
  });

  describe('on success', () => {
    const alliance = {
      id: 1,
      name: 'tester',
    };

    beforeEach(() => {
      getPlayerProfileSpy.mockImplementationOnce(() => Promise.resolve(alliance));
    });

    it('should emit to socket', async () => {
      await PlayerSocket.loadProfile(socket, 1);
      expect(socket.emit).toHaveBeenCalledWith('player:loadProfileSuccess', alliance);
    });
  });
});

describe('updateProfile', () => {
  let getPlayerProfileSpy;
  let updatePlayerSpy;
  let cloudinaryCheckSpy;
  let cloudinaryRemoveSpy;
  beforeEach(() => {
    getPlayerProfileSpy = jest.spyOn(playerQueries, 'getPlayerProfile');
    updatePlayerSpy = jest.spyOn(playerQueries, 'updatePlayer');
    cloudinaryCheckSpy = jest.spyOn(cloudinary, 'isCloudinaryImage');
    cloudinaryRemoveSpy = jest.spyOn(cloudinary, 'cloudinaryDelete');
    jest.spyOn(transaction, 'start').mockImplementationOnce(() => (transactionMock));
  });

  describe('on error', () => {
    it('should rollback transaction and call socket error handler', async () => {
      const error = 'dead';
      getPlayerProfileSpy.mockImplementationOnce(() => { throw error; });

      await PlayerSocket.updateProfile(socket, {});
      expect(transactionRollbackSpy).toHaveBeenCalled();
      expect(socket.handleError).toHaveBeenCalledWith(error, 'updateProfile', `player:updateProfileFail`);
    });

    it('should throw on invalid avatarUrl', async () => {
      getPlayerProfileSpy.mockImplementationOnce(() => ({}));
      cloudinaryCheckSpy.mockImplementationOnce(() => false);
      await PlayerSocket.updateProfile(socket, { avatarUrl: 'yes' });
      expect(socket.handleError).toHaveBeenCalledWith(new ErrorMessage('Invalid avatar'), 'updateProfile', `player:updateProfileFail`);
    });

    it('should throw on update player error', async () => {
      const error = 'dead';
      getPlayerProfileSpy.mockImplementationOnce(() => ({}));
      cloudinaryCheckSpy.mockImplementationOnce(() => true);
      updatePlayerSpy.mockImplementationOnce(() => { throw error; });
      await PlayerSocket.updateProfile(socket, { avatarUrl: 'yes' });
      expect(socket.handleError).toHaveBeenCalledWith(error, 'updateProfile', `player:updateProfileFail`);
    });

    it('should throw on cloudinary delete error', async () => {
      const error = 'dead';
      getPlayerProfileSpy.mockImplementationOnce(() => ({ avatarUrl: 'old' }));
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
      getPlayerProfileSpy.mockImplementationOnce(() => Promise.resolve(player));
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
  let getPlayerProfileSpy;
  let updatePlayerSpy;
  let cloudinaryRemoveSpy;
  beforeEach(() => {
    getPlayerProfileSpy = jest.spyOn(playerQueries, 'getPlayerProfile');
    updatePlayerSpy = jest.spyOn(playerQueries, 'updatePlayer');
    cloudinaryRemoveSpy = jest.spyOn(cloudinary, 'cloudinaryDelete');
    jest.spyOn(transaction, 'start').mockImplementationOnce(() => (transactionMock));
  });

  describe('on error', () => {
    it('should rollback transaction and call socket error handler', async () => {
      const error = 'dead';
      getPlayerProfileSpy.mockImplementationOnce(() => { throw error; });

      await PlayerSocket.removeAvatar(socket);
      expect(transactionRollbackSpy).toHaveBeenCalled();
      expect(socket.handleError).toHaveBeenCalledWith(error, 'removeAvatar', `player:removeAvatarFail`);
    });

    it('should throw on missing avatarUrl', async () => {
      getPlayerProfileSpy.mockImplementationOnce(() => ({}));
      await PlayerSocket.removeAvatar(socket);
      expect(socket.handleError).toHaveBeenCalledWith(new ErrorMessage('No avatar present'), 'removeAvatar', `player:removeAvatarFail`);
    });

    it('should throw on cloudinary delete error', async () => {
      const error = 'dead';
      getPlayerProfileSpy.mockImplementationOnce(() => ({ avatarUrl: 'old' }));
      updatePlayerSpy.mockImplementationOnce(() => null);
      cloudinaryRemoveSpy.mockImplementationOnce(() => { throw error; });
      await PlayerSocket.removeAvatar(socket);
      expect(socket.handleError).toHaveBeenCalledWith(error, 'removeAvatar', `player:removeAvatarFail`);
    });

    it('should throw on update alliance error', async () => {
      const error = 'dead';
      getPlayerProfileSpy.mockImplementationOnce(() => ({ avatarUrl: 'any' }));
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
      getPlayerProfileSpy.mockImplementationOnce(() => Promise.resolve(player));
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
