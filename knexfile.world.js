// Update with your config settings.

const config = require('./src/config/environment'); 

module.exports = {
  [config.env]: {
    ...config.knex.options,
    connection: config.knex.world,
    seeds: {
      directory: './seeds/world'
    },
    migrations: {
      directory: './migrations/world'
    }
  },
};
