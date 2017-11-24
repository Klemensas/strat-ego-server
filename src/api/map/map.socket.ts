import MapManager from '../../components/map';

function sendMapData(/* data */) {
  this.emit('map', MapManager.getAllData());
  this.log(`sending map data ${this.username} on ${this.world}`);
}

export default (socket) => {
  socket.on('map', sendMapData);

  return socket;
};
