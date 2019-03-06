import { UserSocket } from '../../config/socket';
import { rankingService } from './rankingService';

export class RankingSocket {
  static async onConnect(socket: UserSocket) {
    socket.on('rankings:load', (lastUpdate?: number) => this.load(socket, lastUpdate));
  }

  static load(socket: UserSocket, lastUpdate?: number) {
    if (lastUpdate && rankingService.lastUpdate <= lastUpdate) {
      return socket.emit('rankings:loadStagnated');
    }
    socket.emit('rankings:loadSuccess', rankingService.playerRankings);
  }
}
