class MapData {

  constructor() {
    // this.redisClient  = null;
    this.data = {
      townLocations: {},
    };
  }

  initialize(world) {
    // this.setRedisConnection(redis);
    this.worldDB = world;
    this.storeData();
  }

  // setRedisConnection(redis) {
  //   this.redisClient = redis;
  // }

  getAllData() {
  }

  addTown(town) {
    this.data.townLocations[town.location] = {
      _id: town._id,
      name: town.name,
      location: town.location,
      owner: town['Player.name'],
    };
  }

  storeData() {
    return this.worldDB.Town.findAll({
      attributes: ['_id', 'name', 'location'],
      include: [{
        model: this.worldDB.Player,
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
      .catch(err => {
        console.log('ERROR IN REDIS OP', err);
      });
  }

}


export const mapData = new MapData();
