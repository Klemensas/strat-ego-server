import { UserSocket, ErrorMessage, io } from '../../config/socket';
import { getPagedPlayerThreads, createThread } from '../town/messageQueries';
import { Thread } from './thread';
import { getPlayerByName } from '../player/playerQueries';
import { Paging } from 'strat-ego-common';
// import { rankingService } from './rankingService';

export class MessageSocket {
  static async onConnect(socket: UserSocket) {
    socket.on('message:create', (payload: any) => this.create(socket, payload));

    const pagedMessages = await getPagedPlayerThreads(socket.userData.playerId, 0);
    return pagedMessages;
  }

  // static load(socket: UserSocket, lastUpdate?: number) {
  //   if (lastUpdate && rankingService.lastUpdate <= lastUpdate) {
  //     return socket.emit('rankings:loadStagnated');
  //   }
  //   socket.emit('rankings:loadSuccess', rankingService.playerRankings);
  // }

  static async create(socket: UserSocket, payload) {
    const playerId = socket.userData.playerId;
    try {
      const player = await getPlayerByName(payload.target);
      if (!player) { throw new ErrorMessage('Message recipient not found'); }

      const threadPayload: Partial<Thread> = {
        title: payload.title,
        participants: [{ id: player.id }, { id: playerId }],
        messages: [{ text: payload.body, senderId: playerId }],
      };
      const thread = await createThread(threadPayload);
      socket.emit('message:createSuccess', thread);
      this.notifyThreadPlayers(thread);
    } catch (err) {
      socket.handleError(err, 'create', 'message:createFail', payload);
    }
  }

  static getPlayerMessageThreads(socket: UserSocket, pagination: Paging) {
    const playerId = socket.userData.playerId;
    getPagedPlayerThreads(playerId, pagination.page, pagination.pageSize);
  }

  private static notifyThreadPlayers(thread: Thread) {
    thread.participants.forEach(({ id }) => io.sockets.in(`player.${id}`).emit('message:threadReceived', thread));
  }
}
