'use strict';

// Development specific configuration
// ==================================
module.exports = {

  // Sequelize connection opions
  sequelize: {
      options: {
        logging: false/* console.log*/,
        define: {
          timestamps: true,
          paranoid: false
        },
        dialectOptions: {
          supportBigNumbers: true
        }
      },
      main: 'postgres://ffe:test@127.0.0.1:5432/ffe',
      world: 'postgres://ffe:test@127.0.0.1:5432/ffeWorld'
  },

  // Seed database on startup
  seedDB: true

};
