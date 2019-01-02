
exports.up = function(knex, Promise) {
  return knex.schema
    .table('Unit', table => {
      table.integer('farmSpace');
    })
};

exports.down = function(knex, Promise) {
  return knex.schema
    .table('Unit', table => {
      table.dropColumn('farmSpace');
    })
};
