import { EventEmitter } from 'events';

import { UserSocket } from '../../config/socket';
import { AllianceSocket } from './allianceSocket';
import { PlayerRolePayload, RoleUpdatePayload, WarDeclarationPayload, DiplomacyType, MessagePayload } from 'strat-ego-common';

let socket: UserSocket;
beforeEach(() => {
  socket = new EventEmitter() as UserSocket;
  socket.handleError = jest.fn().mockImplementationOnce(() => null);
  // worldData.unitMap = {
  //   sword: { speed: 1 },
  //   archer: { speed: 2 },
  //   horse: { speed: 2 },
  // } as any;
  // worldData.world = {
  //   baseProduction: 500,
  // } as World;
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

  test('should register events', () => {
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

    test('should call creatAlliance on create emit', () => {
      jest.spyOn(AllianceSocket, 'createAlliance').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.createAlliance).not.toHaveBeenCalled();

      const payload = 'test';
      socket.emit('alliance:create', payload);
      expect(AllianceSocket.createAlliance).toHaveBeenCalledWith(socket, payload);
    });

    test('should call createInvite on createInvite emit', () => {
      jest.spyOn(AllianceSocket, 'createInvite').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.createInvite).not.toHaveBeenCalled();

      const payload = 'testPlayer';
      socket.emit('alliance:createInvite', payload);
      expect(AllianceSocket.createInvite).toHaveBeenCalledWith(socket, payload);
    });

    test('should call cancelInvite on cancelInvite emit', () => {
      jest.spyOn(AllianceSocket, 'cancelInvite').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.cancelInvite).not.toHaveBeenCalled();

      const payload = 2;
      socket.emit('alliance:cancelInvite', payload);
      expect(AllianceSocket.cancelInvite).toHaveBeenCalledWith(socket, payload);
    });

    test('should call acceptInvite on acceptInvite emit', () => {
      jest.spyOn(AllianceSocket, 'acceptInvite').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.acceptInvite).not.toHaveBeenCalled();

      const payload = 2;
      socket.emit('alliance:acceptInvite', payload);
      expect(AllianceSocket.acceptInvite).toHaveBeenCalledWith(socket, payload);
    });

    test('should call rejectInvite on rejectInvite emit', () => {
      jest.spyOn(AllianceSocket, 'rejectInvite').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.rejectInvite).not.toHaveBeenCalled();

      const payload = 2;
      socket.emit('alliance:rejectInvite', payload);
      expect(AllianceSocket.rejectInvite).toHaveBeenCalledWith(socket, payload);
    });

    test('should call updatePlayerRole on updateMemberRole emit', () => {
      jest.spyOn(AllianceSocket, 'updatePlayerRole').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.updatePlayerRole).not.toHaveBeenCalled();

      const payload: PlayerRolePayload = { playerId: 13, roleId: 4 };
      socket.emit('alliance:updateMemberRole', payload);
      expect(AllianceSocket.updatePlayerRole).toHaveBeenCalledWith(socket, payload);
    });

    test('should call updateRoles on updateRoles emit', () => {
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

    test('should call removeRole on removeRole emit', () => {
      jest.spyOn(AllianceSocket, 'removeRole').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.removeRole).not.toHaveBeenCalled();

      const payload = 2;
      socket.emit('alliance:removeRole', payload);
      expect(AllianceSocket.removeRole).toHaveBeenCalledWith(socket, payload);
    });

    test('should call removeMember on removeMember emit', () => {
      jest.spyOn(AllianceSocket, 'removeMember').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.removeMember).not.toHaveBeenCalled();

      const payload = 2;
      socket.emit('alliance:removeMember', payload);
      expect(AllianceSocket.removeMember).toHaveBeenCalledWith(socket, payload);
    });

    test('should call leaveAlliance on leave emit', () => {
      jest.spyOn(AllianceSocket, 'leaveAlliance').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.leaveAlliance).not.toHaveBeenCalled();

      socket.emit('alliance:leave');
      expect(AllianceSocket.leaveAlliance).toHaveBeenCalledWith(socket);
    });

    test('should call destroyAlliance on destroy emit', () => {
      jest.spyOn(AllianceSocket, 'destroyAlliance').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.destroyAlliance).not.toHaveBeenCalled();

      socket.emit('alliance:destroy');
      expect(AllianceSocket.destroyAlliance).toHaveBeenCalledWith(socket);
    });

    test('should call startWar on declareWar emit', () => {
      jest.spyOn(AllianceSocket, 'startWar').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.startWar).not.toHaveBeenCalled();

      const payload: WarDeclarationPayload = { targetName: 'test', reason: 'too real' };
      socket.emit('alliance:declareWar', payload);
      expect(AllianceSocket.startWar).toHaveBeenCalledWith(socket, payload);
    });

    test('should call proposeDiplo on proposeAlliance emit', () => {
      jest.spyOn(AllianceSocket, 'proposeDiplo').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.proposeDiplo).not.toHaveBeenCalled();

      const payload = 'testAlliance';
      socket.emit('alliance:proposeAlliance', payload);
      expect(AllianceSocket.proposeDiplo).toHaveBeenCalledWith(socket, payload, DiplomacyType.alliance);
    });

    test('should call proposeDiplo on proposeNap emit', () => {
      jest.spyOn(AllianceSocket, 'proposeDiplo').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.proposeDiplo).not.toHaveBeenCalled();

      const payload = 'testAlliance';
      socket.emit('alliance:proposeNap', payload);
      expect(AllianceSocket.proposeDiplo).toHaveBeenCalledWith(socket, payload, DiplomacyType.nap);
    });

    test('should call cancelDiplo on cancelAlliance emit', () => {
      jest.spyOn(AllianceSocket, 'cancelDiplo').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.cancelDiplo).not.toHaveBeenCalled();

      const payload = 2;
      socket.emit('alliance:cancelAlliance', payload);
      expect(AllianceSocket.cancelDiplo).toHaveBeenCalledWith(socket, payload, DiplomacyType.alliance);
    });

    test('should call cancelDiplo on cancelNap emit', () => {
      jest.spyOn(AllianceSocket, 'cancelDiplo').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.cancelDiplo).not.toHaveBeenCalled();

      const payload = 2;
      socket.emit('alliance:cancelNap', payload);
      expect(AllianceSocket.cancelDiplo).toHaveBeenCalledWith(socket, payload, DiplomacyType.nap);
    });

    test('should call rejectDiplo on rejectAlliance emit', () => {
      jest.spyOn(AllianceSocket, 'rejectDiplo').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.rejectDiplo).not.toHaveBeenCalled();

      const payload = 2;
      socket.emit('alliance:rejectAlliance', payload);
      expect(AllianceSocket.rejectDiplo).toHaveBeenCalledWith(socket, payload, DiplomacyType.alliance);
    });

    test('should call rejectDiplo on rejectNap emit', () => {
      jest.spyOn(AllianceSocket, 'rejectDiplo').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.rejectDiplo).not.toHaveBeenCalled();

      const payload = 2;
      socket.emit('alliance:rejectNap', payload);
      expect(AllianceSocket.rejectDiplo).toHaveBeenCalledWith(socket, payload, DiplomacyType.nap);
    });

    test('should call acceptDiplo on acceptAlliance emit', () => {
      jest.spyOn(AllianceSocket, 'acceptDiplo').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.acceptDiplo).not.toHaveBeenCalled();

      const payload = 2;
      socket.emit('alliance:acceptAlliance', payload);
      expect(AllianceSocket.acceptDiplo).toHaveBeenCalledWith(socket, payload, DiplomacyType.alliance);
    });

    test('should call acceptDiplo on acceptNap emit', () => {
      jest.spyOn(AllianceSocket, 'acceptDiplo').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.acceptDiplo).not.toHaveBeenCalled();

      const payload = 2;
      socket.emit('alliance:acceptNap', payload);
      expect(AllianceSocket.acceptDiplo).toHaveBeenCalledWith(socket, payload, DiplomacyType.nap);
    });

    test('should call endDiplo on endAlliance emit', () => {
      jest.spyOn(AllianceSocket, 'endDiplo').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.endDiplo).not.toHaveBeenCalled();

      const payload = 2;
      socket.emit('alliance:endAlliance', payload);
      expect(AllianceSocket.endDiplo).toHaveBeenCalledWith(socket, payload, DiplomacyType.alliance);
    });

    test('should call endDiplo on endNap emit', () => {
      jest.spyOn(AllianceSocket, 'endDiplo').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.endDiplo).not.toHaveBeenCalled();

      const payload = 2;
      socket.emit('alliance:endNap', payload);
      expect(AllianceSocket.endDiplo).toHaveBeenCalledWith(socket, payload, DiplomacyType.nap);
    });

    test('should call postMessage on postMessage emit', () => {
      jest.spyOn(AllianceSocket, 'postMessage').mockImplementationOnce(() => null);
      socket.emit('anything');
      expect(AllianceSocket.postMessage).not.toHaveBeenCalled();

      const payload: MessagePayload = { text: 'test message', messageStamp: 2 };
      socket.emit('chat:postMessage', payload);
      expect(AllianceSocket.postMessage).toHaveBeenCalledWith(socket, payload);
    });

  });
});
