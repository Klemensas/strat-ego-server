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
db.world.Restaurant = db.world.sequelize.import('../api/restaurant/restaurant.model');

// db.World.belongsToMany(db.User, { through: 'WorldUsers' });

db.main.User.hasMany(db.main.Message);
db.main.Message.belongsTo(db.main.User);

db.main.UserWorlds = db.main.sequelize.define('UserWorlds', {
  PlayerId: {
    type: Sequelize.INTEGER,
    allowNull: false,
    primaryKey: true,
  },
  World: {
    type: Sequelize.STRING,
    allowNull: false,
    primaryKey: true,
  },
});

db.main.User.hasMany(db.main.UserWorlds);
db.main.UserWorlds.belongsTo(db.main.User);

db.world.Player.hasMany(db.world.Restaurant);
db.world.Restaurant.belongsTo(db.world.Player);

// console.log(db.main.User, typeof db.main.User)
// db.world.Player.sync()
//   .then(u => {
//     // u.addUser(1);
//   })
//   .catch(e => {
//     console.log('-------')
//     console.log(e)
//     console.log('-------')
//   })
// db.main.User.sync()
//   .then(u => u.findOne())
//   .then(u => {
//     // db.world.User.setUser(u);
//     // console.log(db.world.User.associations.User/*Object.keys(db.world.User)*/);
//   })
//   .catch(e => {
//     console.log('-------~')
//     console.log(e)
//     console.log('-------~')
//   })
  // .then(() => db.main.User.findOne({ where: {} }))
  // .then(u => console.log(u))



module.exports = db;
