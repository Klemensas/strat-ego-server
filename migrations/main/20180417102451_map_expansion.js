
exports.up = function(knex, Promise) {
  return knex.schema.table('World', table => {
    table.integer('expansionRate').unsigned().notNullable();
    table.float('expansionGrowth').unsigned().notNullable();
    table.bigInteger('lastExpansion').unsigned().notNullable();
  });
};

exports.down = function(knex, Promise) {
  return knex.schema.table('World', table => {
    table.dropColumns('expansionRate', 'expansionGrowth', 'lastExpansion');
  });
};
