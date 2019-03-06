import { EventEmitter } from 'events';

import { RankingSocket } from './rankingSocket';
import { UserSocket } from '../../config/socket';
import { rankingService } from './rankingService';

let socket: UserSocket;
beforeEach(() => {
  socket = new EventEmitter() as UserSocket;
  jest.spyOn(socket, 'emit');
});
describe('onConnect', () => {
  const socketEvents = ['rankings:load'];

  it('should register events', () => {
    expect(socket.eventNames()).toHaveLength(0);
    RankingSocket.onConnect(socket);
    expect(socket.eventNames()).toEqual(socketEvents);
  });

  describe('events', () => {
    beforeEach(() => {
      RankingSocket.onConnect(socket);
    });

    it('should call load on emit', () => {
      jest.spyOn(RankingSocket, 'load').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(RankingSocket.load).not.toHaveBeenCalled();

      const time = Date.now();
      socket.emit('rankings:load', time);
      expect(RankingSocket.load).toHaveBeenCalledWith(socket, time);
    });
  });
});

describe('load', () => {
  const lastUpdate = 2;
  beforeEach(() => {
    rankingService.lastUpdate = lastUpdate;
  });

  it('should emit loadSuccess if lastUpdate missing', () => {
    RankingSocket.load(socket);
    expect(socket.emit).toHaveBeenCalledTimes(1);
    expect(socket.emit).toHaveBeenCalledWith('rankings:loadSuccess', []);
  });

  it('should emit loadSuccess if scoreTracker updated', () => {
    RankingSocket.load(socket, 1);
    expect(socket.emit).toHaveBeenCalledTimes(1);
    expect(socket.emit).toHaveBeenCalledWith('rankings:loadSuccess', []);
  });

  it('should emit loadStagnated if scoreTracker not updated', () => {
    RankingSocket.load(socket, 3);
    expect(socket.emit).toHaveBeenCalledTimes(1);
    expect(socket.emit).toHaveBeenCalledWith('rankings:loadStagnated');
  });
});
