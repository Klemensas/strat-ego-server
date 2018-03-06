
exports.up = function(knex, Promise) {
  return knex.schema
    .createTable('Unit', table => {
      table.increments('id').primary();
      table.string('name').unique();
      table.string('attackType');
      table.integer('speed').notNullable();
      table.integer('recruitTime').notNullable();
      table.integer('haul').notNullable();
      table.specificType('requirements', 'json[]');
      table.json('costs');
      table.json('combat');
      table.timestamp('createdAt').defaultTo(knex.fn.now()).notNullable();
      table.timestamp('updatedAt').defaultTo(knex.fn.now()).notNullable();
    })
    .createTable('Building', table => {
      table.increments('id').primary();
      table.string('name').unique();
      table.json('levels');
      table.specificType('requirements', 'json[]');
      table.specificType('data', 'json[]');
      table.timestamp('createdAt').defaultTo(knex.fn.now()).notNullable();
      table.timestamp('updatedAt').defaultTo(knex.fn.now()).notNullable();
    });
};

exports.down = function(knex, Promise) {
  return knex.schema
    .dropTableIfExists('Unit')
    .dropTableIfExists('Building')
};
