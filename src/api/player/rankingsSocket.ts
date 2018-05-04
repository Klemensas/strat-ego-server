import { UserSocket } from '../../config/socket';
import { scoreTracker } from './playerScore';

export class RankingsSocket {
  static async onConnect(socket: UserSocket) {
    socket.on('rankings:load', (lastUpdate?: number) => this.load(socket, lastUpdate));
  }

  static load(socket: UserSocket, lastUpdate?: number) {
    if (lastUpdate && scoreTracker.lastUpdate <= lastUpdate) {
      return socket.emit('rankings:loadStagnated');
    }
    socket.emit('rankings:loadSuccess', scoreTracker.scores);
  }
}
