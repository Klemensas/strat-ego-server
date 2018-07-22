
exports.up = function(knex, Promise) {
  return knex.schema
    .table('Player', table => {
      table.integer('tutorialStage').defaultTo(0);
    })
};

exports.down = function(knex, Promise) {
  return knex.schema
    .table('Player', table => {
      table.dropColumn('tutorialStage');
    })
};
