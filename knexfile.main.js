// Update with your config settings.

const config = require('./src/config/environment'); 

module.exports = {
  [config.env]: {
    ...config.knex.options,
    connection: config.knex.main,
    seeds: {
      directory: './seeds/main'
    },
    migrations: {
      directory: './migrations/main'
    }
  },
};
