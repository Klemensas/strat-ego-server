import { RankingsSocket } from './rankingsSocket';
import { EventEmitter } from 'events';
import { UserSocket } from '../../config/socket';
import { scoreTracker } from './playerScore';

let socket: UserSocket;
beforeEach(() => {
  socket = new EventEmitter() as UserSocket;
  jest.spyOn(socket, 'emit');
});
describe('onConnect', () => {
  const socketEvents = ['rankings:load'];

  test('should register events', () => {
    expect(socket.eventNames()).toHaveLength(0);
    RankingsSocket.onConnect(socket);
    expect(socket.eventNames()).toEqual(socketEvents);
  });

  describe('events', () => {
    beforeEach(() => {
      RankingsSocket.onConnect(socket);
    });

    test('should call load on emit', () => {
      jest.spyOn(RankingsSocket, 'load').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(RankingsSocket.load).not.toHaveBeenCalled();

      const time = Date.now();
      socket.emit('rankings:load', time);
      expect(RankingsSocket.load).toHaveBeenCalledWith(socket, time);
    });
  });
});

describe('load', () => {
  const lastUpdate = 2;
  beforeEach(() => {
    scoreTracker.lastUpdate = lastUpdate;
  });

  test('should emit loadSuccess if lastUpdate missing', () => {
    RankingsSocket.load(socket);
    expect(socket.emit).toHaveBeenCalledTimes(1);
    expect(socket.emit).toHaveBeenCalledWith('rankings:loadSuccess', []);
  });

  test('should emit loadSuccess if scoreTracker updated', () => {
    RankingsSocket.load(socket, 1);
    expect(socket.emit).toHaveBeenCalledTimes(1);
    expect(socket.emit).toHaveBeenCalledWith('rankings:loadSuccess', []);
  });

  test('should emit loadStagnated if scoreTracker not updated', () => {
    RankingsSocket.load(socket, 3);
    expect(socket.emit).toHaveBeenCalledTimes(1);
    expect(socket.emit).toHaveBeenCalledWith('rankings:loadStagnated');
  });
});
