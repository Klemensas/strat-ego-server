const path = require('path');
const test = require('./test');
const development = require('./development');
const production = require('./production');

// TODO: cleanup here, take a fresh look at variables and import only the required env
const env = process.env.NODE_ENV || 'development';

const envVariables = {
  test,
  development,
  production,
};
module.exports = {
  env,
  ip: process.env.IP || '0.0.0.0',
  port: process.env.PORT || 9000,
  root: path.normalize(path.join(__dirname, '/../../..')),
  secrets: {
    session: process.env.APP_SECRET || 'secret',
  },
  userRoles: ['member', 'admin'],
  knex: {
    options: {
      client: 'postgresql',
      migrations: {
        tableName: 'knex_migrations'
      },
    },
    main: process.env.DB_MAIN || 'postgres://stratego:supasecretpassword@localhost:5433/stratego',
    world: process.env.DB_WORLD || 'postgres://stratego:supasecretpassword@localhost:5433/strategoWorld'
  },
  redisPort: process.env.REDIS_PORT || 6379,
  cloudinary: {
    name: process.env.CLOUDINARY_NAME,
    apiKey: process.env.CLOUDINARY_API,
    apiSecret: process.env.CLOUDINARY_SECRET
  },
  seed: {
    queueRate: +(process.env.QUEUE_RATE || 0.5),
    queueCount: +(process.env.QUEUE_COUNT || 100),
    queueSpread: +(process.env.QUEUE_SPREAD || 600000 /* 86400000 */),
    expansionRate: +(process.env.EXPANSION_RATE || 172800000),
    expansionGrowth: +(process.env.EXPANSION_GROWTH || 1.1),
    speed: +(process.env.WORLD_SPEED || 100),
    demoUserCount: +(process.env.DEMO_USERS || 10),
    baseProduction: +(process.env.BASE_PRODUCTION || 5000),
  },
  ...envVariables[env],
};
