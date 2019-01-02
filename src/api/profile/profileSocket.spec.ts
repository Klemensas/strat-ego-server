import { EventEmitter } from 'events';

import { ProfileSocket } from './profileSocket';
import { UserSocket } from '../../config/socket';
import { ProfileService } from './profileService';

let socket: UserSocket;
beforeEach(() => {
  socket = new EventEmitter() as UserSocket;
  socket.handleError = jest.fn().mockImplementation(() => null);
  jest.spyOn(socket, 'emit');
});
describe('onConnect', () => {
  const socketEvents = [
    'profile:loadPlayers',
    'profile:loadTowns',
    'profile:loadAlliances',
  ];

  it('should register events', () => {
    expect(socket.eventNames()).toHaveLength(0);
    ProfileSocket.onConnect(socket);
    expect(socket.eventNames()).toEqual(socketEvents);
  });

  describe('events', () => {
    beforeEach(() => {
      ProfileSocket.onConnect(socket);
    });

    it('should call loadPlayerProfiles on emit', () => {
      jest.spyOn(ProfileSocket, 'loadPlayerProfiles').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(ProfileSocket.loadPlayerProfiles).not.toHaveBeenCalled();

      const payload = [1, 123];
      socket.emit('profile:loadPlayers', payload);
      expect(ProfileSocket.loadPlayerProfiles).toHaveBeenCalledWith(socket, payload);
    });

    it('should call loadTownProfiles on emit', () => {
      jest.spyOn(ProfileSocket, 'loadTownProfiles').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(ProfileSocket.loadTownProfiles).not.toHaveBeenCalled();

      const payload = [1, 123];
      socket.emit('profile:loadTowns', payload);
      expect(ProfileSocket.loadTownProfiles).toHaveBeenCalledWith(socket, payload);
    });

    it('should call loadAllianceProfiles on emit', () => {
      jest.spyOn(ProfileSocket, 'loadAllianceProfiles').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(ProfileSocket.loadAllianceProfiles).not.toHaveBeenCalled();

      const payload = [1, 123];
      socket.emit('profile:loadAlliances', payload);
      expect(ProfileSocket.loadAllianceProfiles).toHaveBeenCalledWith(socket, payload);
    });
  });
});

describe('loadPlayerProfiles', () => {
  const payload = [1, 123];

  it('should throw on profile fetch error', async () => {
    const error = 'dead';
    jest.spyOn(ProfileService, 'getPlayerProfile').mockImplementationOnce(() => { throw error; });
    await ProfileSocket.loadPlayerProfiles(socket, payload);

    expect(socket.emit).not.toHaveBeenCalled();
    expect(socket.handleError).toHaveBeenCalledWith(error, 'profiles', `profile:loadPlayersFail`, payload);
  });

  it('should emit loadSuccess on player load', async () => {
    const profiles = { 2: { name: 'test' }, 3: { wat: true } };
    jest.spyOn(ProfileService, 'getPlayerProfile').mockImplementationOnce(() => profiles);
    await ProfileSocket.loadPlayerProfiles(socket, payload);

    expect(socket.emit).toHaveBeenCalledTimes(1);
    expect(socket.emit).toHaveBeenCalledWith('profile:loadPlayersSuccess', profiles);
  });
});

describe('loadTownProfiles', () => {
  const payload = [1, 123];

  it('should throw on profile fetch error', async () => {
    const error = 'dead';
    jest.spyOn(ProfileService, 'getTownProfile').mockImplementationOnce(() => { throw error; });
    await ProfileSocket.loadTownProfiles(socket, payload);

    expect(socket.emit).not.toHaveBeenCalled();
    expect(socket.handleError).toHaveBeenCalledWith(error, 'profiles', `profile:loadTownsFail`, payload);
  });

  it('should emit loadSuccess on town load', async () => {
    const profiles = { 2: { name: 'test' }, 3: { wat: true } };
    jest.spyOn(ProfileService, 'getTownProfile').mockImplementationOnce(() => profiles);
    await ProfileSocket.loadTownProfiles(socket, payload);

    expect(socket.emit).toHaveBeenCalledTimes(1);
    expect(socket.emit).toHaveBeenCalledWith('profile:loadTownsSuccess', profiles);
  });
});

describe('loadAllianceProfiles', () => {
  const payload = [1, 123];

  it('should throw on profile fetch error', async () => {
    const error = 'dead';
    jest.spyOn(ProfileService, 'getAllianceProfile').mockImplementationOnce(() => { throw error; });
    await ProfileSocket.loadAllianceProfiles(socket, payload);

    expect(socket.emit).not.toHaveBeenCalled();
    expect(socket.handleError).toHaveBeenCalledWith(error, 'profiles', `profile:loadAlliancesFail`, payload);
  });

  it('should emit loadSuccess on alliance load', async () => {
    const profiles = { 2: { name: 'test' }, 3: { wat: true } };
    jest.spyOn(ProfileService, 'getAllianceProfile').mockImplementationOnce(() => profiles);
    await ProfileSocket.loadAllianceProfiles(socket, payload);

    expect(socket.emit).toHaveBeenCalledTimes(1);
    expect(socket.emit).toHaveBeenCalledWith('profile:loadAlliancesSuccess', profiles);
  });
});
