
exports.up = function(knex, Promise) {
  return knex.schema.table('Town', table => {
    table.integer('score').unsigned().notNullable();
  });
};

exports.down = function(knex, Promise) {
  return knex.schema.table('Town', table => {
    table.dropColumn('score');
  })
};
