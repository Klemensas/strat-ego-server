import config from '../config/environment';
import Sequelize from 'sequelize';

import * as redis from 'redis';

const redisClient = redis.createClient();
redisClient.on('error', error => {
  console.log(`REDIS ERROR: ${error}`);
});

const db = {
  Sequelize,
  main: { sequelize: new Sequelize(config.sequelize.main, config.sequelize.options) },
  world: { sequelize: new Sequelize(config.sequelize.world, config.sequelize.options) },
};


// Insert models below
db.main.User = db.main.sequelize.import('../api/user/user.model');
db.main.Message = db.main.sequelize.import('../api/message/message.model');
db.main.World = db.main.sequelize.import('../api/world/world.model');

db.world.Building = db.world.sequelize.import('../api/world/building.model');
db.world.Unit = db.world.sequelize.import('../api/world/unit.model');
db.world.Player = db.world.sequelize.import('../api/world/player.model');
db.world.Town = db.world.sequelize.import('../api/town/town.model');
db.world.BuildingQueue = db.world.sequelize.import('../api/world/building.queue.model');
db.world.UnitQueue = db.world.sequelize.import('../api/world/unit.queue.model');

// db.World.belongsToMany(db.User, { through: 'WorldUsers' });

db.main.User.hasMany(db.main.Message);
db.main.Message.belongsTo(db.main.User);

db.main.UserWorlds = db.main.sequelize.define('UserWorlds', {
  PlayerId: {
    type: Sequelize.INTEGER,
    allowNull: false,
  },
  World: {
    type: Sequelize.STRING,
    allowNull: false,
  },
});

db.main.User.hasMany(db.main.UserWorlds);
db.main.UserWorlds.belongsTo(db.main.User);

db.world.Player.hasMany(db.world.Town);
db.world.Town.belongsTo(db.world.Player);

db.world.Town.hasMany(db.world.UnitQueue);
db.world.UnitQueue.belongsTo(db.world.Town);
db.world.Town.hasMany(db.world.BuildingQueue);
db.world.BuildingQueue.belongsTo(db.world.Town);

export const main = db.main;
export const world = db.world;
export { redisClient };
