import { activeWorlds } from '../../components/worlds';
import { world } from '../../sqldb';
import { queue } from '../world/queue';

function sendMapData(data) {
  console.log('hi i should sendMapData')
}

export const initializeMapSocket = socket => {
  socket.on('map', sendMapData);
  return socket;
};
