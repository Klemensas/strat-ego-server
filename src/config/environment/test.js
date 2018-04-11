module.exports = {
  knex: {
    options: {
      client: 'postgresql',
      migrations: {
        tableName: 'knex_migrations'
      },
    },
    main: 'postgres://stratego:supasecretpassword@localhost:5433/testStratego',
    world: 'postgres://stratego:supasecretpassword@localhost:5433/testStrategoWorld'
  }
};
