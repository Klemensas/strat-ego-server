module.exports = {
  knex: {
    options: {
      client: 'postgresql',
      migrations: {
        tableName: 'knex_migrations'
      },
    },
    main: 'postgres://stratego:supasecretpassword@localhost:5432/testStratego',
    world: 'postgres://stratego:supasecretpassword@localhost:5432/testStrategoWorld'
  },
  seed: {
    townPercent: +(process.env.TOWN_PERCENT || 0.5),
    townArea: +(process.env.TOWN_AREA || 5),
    townDistance: +(process.env.TOWN_DISTANCE || 5),
    queueRate: +(process.env.QUEUE_RATE || 1),
    queueCount: +(process.env.QUEUE_COUNT || 10),
    queueSpread: +(process.env.QUEUE_SPREAD || 1000),
    speed: +(process.env.WORLD_SPEED || 1),
    demoUserCount: +(process.env.DEMO_USERS || 10),
    baseProduction: +(process.env.BASE_PRODUCTION || 5000),
  },
};
