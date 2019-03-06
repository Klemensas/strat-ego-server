
exports.up = function(knex, Promise) {
  return knex.schema
    .createTable('Thread', table => {
      table.increments('id').primary();
      table.string('title');
      table.bigInteger('createdAt').unsigned().notNullable();
      table.bigInteger('updatedAt').unsigned().notNullable();
    })
    .createTable('ThreadParticipant', table => {
      table.increments('id').primary();
      table.integer('threadId').unsigned().references('id').inTable('Thread').onDelete('CASCADE');
      table.integer('playerId').unsigned().references('id').inTable('Player').onDelete('CASCADE');
    })
    .createTable('Message', table => {
      table.increments('id').primary();
      table.integer('threadId').unsigned().references('id').inTable('Thread').onDelete('CASCADE');
      table.integer('senderId').unsigned().references('id').inTable('Player').onDelete('CASCADE');
      table.text('text');
      table.bigInteger('createdAt').unsigned().notNullable();
      table.bigInteger('updatedAt').unsigned().notNullable();
    })
    .createTable('MessageState', table => {
      table.increments('id').primary();
      table.integer('messageId').unsigned().references('id').inTable('Message').onDelete('CASCADE');
      table.integer('playerId').unsigned().references('id').inTable('Player').onDelete('CASCADE');
      table.boolean('read');
      table.bigInteger('createdAt').unsigned().notNullable();
      table.bigInteger('updatedAt').unsigned().notNullable();
    })
};

exports.down = function(knex, Promise) {
  return knex.schema
    .dropTableIfExists('MessageState')
    .dropTableIfExists('Message')
    .dropTableIfExists('ThreadParticipant')
    .dropTableIfExists('Thread')
};
