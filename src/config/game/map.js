import { world } from '../../sqldb';

const Player = world.Player;
const Town = world.Town;

class MapData {

  constructor() {
    // this.redisClient = null;
    this.data = {
      townLocations: {},
    };
  }

  initialize(/* redis */) {
    // this.setRedisConnection(redis);
    this.storeData();
  }

  // setRedisConnection(redis) {
  //   this.redisClient = redis;
  // }

  getAllData() {
    console.log(this.data.townLocations)
  }

  storeData() {
    return Town.findAll({
      attributes: ['_id', 'name', 'location'],
      include: [{
        model: Player,
        attributes: ['name'],
      }],
      raw: true,
    })
      .then(towns => {
        this.data.townLocations = towns.reduce((data, town) => {
          data[town.location] = {
            _id: town._id,
            name: town.name,
            location: town.location,
            owner: town['Player.name'],
          };
          return data;
        }, {});
      })
      .then(() => this.getAllData())
      .catch(err => {
        console.log('ERROR IN REDIS OP', err);
      });
  }

}


export const mapData = new MapData();
