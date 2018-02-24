const path = require('path');

module.exports = {
  env: process.env.NODE_ENV || 'development',
  ip: process.env.IP || '0.0.0.0',
  port: process.env.PORT || 9000,
  root: path.normalize(path.join(__dirname, '/../../..')),
  secrets: {
    session: process.env.APP_SECRET || 'secret',
  },
  userRoles: ['member', 'admin'],
  seedDB: process.env.SEED_DATA || false,
  sequelize: {
    options: {
      logging: /* false */console.log,
      define: {
        timestamps: true,
        paranoid: false,
        version: true,
      },
    },
    main: process.env.DB_MAIN || 'postgres://stratego:supasecretpassword@localhost:5432/stratego',
    world: process.env.DB_WORLD || 'postgres://stratego:supasecretpassword@localhost:5432/strategoWorld',
  },
  knex: {
    options: {
      client: 'postgresql',
      debug: true,
      migrations: {
        tableName: 'knex_migrations'
      },
    },
    main: process.env.DB_MAIN || 'postgres://stratego:supasecretpassword@localhost:5432/stratego',
    world: process.env.DB_MAIN || {
      host: 'localhost:5432',
      user: 'stratego',
      password: 'supasecretpassword',
      database: 'stategoWorld',
    }
  }
};
