exports.up = function(knex, Promise) {
  return knex.schema.table('World', table => {
    table.integer('townGrowthInterval').unsigned().notNullable().defaultTo(14400000);
    table.bigInteger('townLastGrowth').unsigned().notNullable().defaultTo(Date.now());
  });
};

exports.down = function(knex, Promise) {
  return knex.schema.table('World', table => {
    table.dropColumn('townGrowthInterval');
    table.dropColumn('townLastGrowth');
  })
};
