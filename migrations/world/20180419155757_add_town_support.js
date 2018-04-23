
exports.up = function(knex, Promise) {
  return knex.schema
    .createTable('TownSupport', table => {
      table.increments('id').primary();
      table.jsonb('units').notNullable();
      table.integer('originTownId').unsigned().references('id').inTable('Town').onDelete('CASCADE');
      table.integer('targetTownId').unsigned().references('id').inTable('Town').onDelete('CASCADE');
      table.bigInteger('createdAt').unsigned().notNullable();
      table.bigInteger('updatedAt').unsigned().notNullable();
    })
};

exports.down = function(knex, Promise) {
  return knex.schema
    .dropTableIfExists('TownSupport')
};
