import { activeWorlds } from '../../components/worlds';
import { world } from '../../sqldb';
import { queue } from '../world/queue';
import { mapData } from '../../config/game/map';

function sendMapData(data) {
  this.emit('map', mapData.getAllData());
}

export const initializeMapSocket = socket => {
  socket.on('map', sendMapData);

  return socket;
};
