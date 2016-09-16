/**
 * Sequelize initialization module
 */

import config from '../config/environment';
import Sequelize from 'sequelize';

const db = {
  Sequelize,
  main: { sequelize: new Sequelize(config.sequelize.main, config.sequelize.options) },
  world: { sequelize: new Sequelize(config.sequelize.world, config.sequelize.options) },
};


// Insert models below
db.main.User = db.main.sequelize.import('../api/user/user.model');
db.main.Message = db.main.sequelize.import('../api/message/message.model');
db.main.World = db.main.sequelize.import('../api/world/world.model');

db.world.Player = db.world.sequelize.import('../api/world/player.model');
db.world.Town = db.world.sequelize.import('../api/town/town.model');

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

module.exports = db;
