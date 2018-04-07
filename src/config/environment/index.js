const path = require('path');

const env = process.env.NODE_ENV || 'development';
const envVariables = require(`./${env}`);

module.exports = {
  env,
  ip: process.env.IP || '0.0.0.0',
  port: process.env.PORT || 9000,
  root: path.normalize(path.join(__dirname, '/../../..')),
  secrets: {
    session: process.env.APP_SECRET || 'secret',
  },
  userRoles: ['member', 'admin'],
  seedDB: process.env.SEED_DATA || false,
  knex: {
    options: {
      client: 'postgresql',
      migrations: {
        tableName: 'knex_migrations'
      },
    },
    main: process.env.DB_MAIN || 'postgres://stratego:supasecretpassword@localhost:5432/stratego',
    world: process.env.DB_WORLD || 'postgres://stratego:supasecretpassword@localhost:5432/strategoWorld'
  },
  ...envVariables,
};
