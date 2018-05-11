
exports.up = function(knex, Promise) {
  return knex.schema
    .table('Player', table => {
      table.text('description');
      table.string('avatarUrl');
    })
    .table('Alliance', table => {
      table.text('description');
      table.string('avatarUrl');
    })
};

exports.down = function(knex, Promise) {
  return knex.schema
    .table('Player', table => {
      table.dropColumn('description');
      table.dropColumn('avatarUrl');
    })
    .table('Alliance', table => {
      table.dropColumn('description');
      table.dropColumn('avatarUrl');
    })
};
