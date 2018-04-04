
exports.up = function(knex, Promise) {
  return knex.schema
    .createTable('User', table => {
      table.increments('id').primary();
      table.string('name').unique();
      table.string('email').unique();
      table.string('password').notNullable();
      table.string('salt').notNullable();
      table.string('role').notNullable();
      table.string('provider').notNullable();
      table.json('facebook');
      table.json('twitter');
      table.json('google');
      table.json('github');
      table.bigInteger('createdAt').unsigned().notNullable();
      table.bigInteger('updatedAt').unsigned().notNullable();
    })
    .createTable('World', table => {
      table.string('name').primary();
      table.integer('baseProduction').notNullable();
      table.integer('speed').notNullable();
      table.integer('size').notNullable();
      table.integer('regionSize').notNullable();
      table.float('fillTime').notNullable();
      table.float('fillPercent').notNullable();
      table.float('barbPercent').notNullable();
      table.float('timeQouta').notNullable();
      table.integer('generationArea').notNullable();
      table.integer('currentRing').notNullable();
      table.integer('initialLoyalty').notNullable();
      table.integer('loyaltyRegeneration').notNullable();
      table.specificType('loyaltyReductionRange', 'integer[]').notNullable();
      table.bigInteger('createdAt').unsigned().notNullable();
      table.bigInteger('updatedAt').unsigned().notNullable();
    })
    .createTable('UserWorld', table => {
      table.increments('id').primary();
      table
        .integer('userId')
        .unsigned()
        .references('id')
        .inTable('User')
        .onDelete('CASCADE');
      table
        .string('worldName')
        .references('name')
        .inTable('World')
        .onDelete('CASCADE');
      table.integer('playerId').unsigned().unique().notNullable()
      table.bigInteger('createdAt').unsigned().notNullable();
      table.bigInteger('updatedAt').unsigned().notNullable();
    })
};

exports.down = function(knex, Promise) {
  return knex.schema
    .dropTableIfExists('UserWorld')
    .dropTableIfExists('User')
    .dropTableIfExists('World')
};
