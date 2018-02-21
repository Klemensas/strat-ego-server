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
    return this.data.townLocations;
  } 

  addTown(town) {
    const owner = town.Player ? town.Player.name : town['Player.name'];

    this.data.townLocations[town.location] = {
      id: town.id,
      name: town.name,
      location: town.location,
      owner,
    };
  }

  storeData() {
    return this.worldDB.Town.findAll({
      attributes: ['id', 'name', 'location'],
      include: [{
        model: this.worldDB.Player,
        attributes: ['name'],
      }],
      raw: true,
    })
      .then(towns => {
        this.data.townLocations = towns.reduce((data, town) => {
          data[town.location] = {
            id: town.id,
            name: town.name,
            location: town.location,
            owner: town['Player.name'],
          };
          return data;
        }, {});
        console.log(`stored ${towns.length} town map data`);
      })
      .catch(err => {
        console.log('ERROR IN REDIS OP', err);
      });
  }

}

export default new MapData();
