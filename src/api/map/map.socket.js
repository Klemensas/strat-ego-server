// import { activeWorlds } from '../../components/worlds';
import mapData from '../../config/game/map';

function sendMapData(/* data */) {
  this.emit('map', mapData.getAllData());
  this.log(`sending map data ${this.username} on ${this.world}`);
}

export default socket => {
  socket.on('map', sendMapData);

  return socket;
};
