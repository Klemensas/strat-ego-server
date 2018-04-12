exports.up = function(knex, Promise) {
  return knex.schema.table('World', table => {
    table.integer('townGrowthInterval').unsigned().notNullable();
    table.bigInteger('townLastGrowth').unsigned().notNullable();
  });
};

exports.down = function(knex, Promise) {
  return knex.schema.table('World', table => {
    table.dropColumn('townGrowthInterval');
    table.dropColumn('townLastGrowth');
  })
};
