import { UserSocket } from '../../config/socket';
import { worldData } from '../world/worldData';

export class MapSocket {
  public static onConnect(socket: UserSocket) {
    socket.on('map', (payload) => this.sendMapData(socket, payload));
  }

  private static sendMapData(socket: UserSocket, payload?: any) {
    socket.emit('map', worldData.mapManager.getAllData());
  }
}
