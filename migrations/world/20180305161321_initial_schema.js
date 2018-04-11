exports.up = function(knex, Promise) {
  return knex.schema
    .createTable('Unit', table => {
      table.increments('id').primary();
      table.string('name').unique();
      table.string('attackType');
      table.integer('speed').notNullable();
      table.integer('recruitTime').notNullable();
      table.integer('haul').notNullable();
      table.specificType('requirements', 'jsonb[]');
      table.jsonb('costs');
      table.jsonb('combat');
      table.bigInteger('createdAt').unsigned().notNullable();
      table.bigInteger('updatedAt').unsigned().notNullable();
    })
    .createTable('Building', table => {
      table.increments('id').primary();
      table.string('name').unique();
      table.jsonb('levels');
      table.specificType('requirements', 'jsonb[]');
      table.specificType('data', 'jsonb[]');
      table.bigInteger('createdAt').unsigned().notNullable();
      table.bigInteger('updatedAt').unsigned().notNullable();
    })
    .createTable('Player', table => {
      table.increments('id').primary();
      table.string('name').unique();
      table.integer('userId').unique();
      table.bigInteger('createdAt').unsigned().notNullable();
      table.bigInteger('updatedAt').unsigned().notNullable();
    })
    .createTable('Town', table => {
      table.increments('id').primary();
      table.string('name').notNullable();
      table.integer('loyalty').notNullable();
      table.specificType('location', 'integer[]').unique();
      table.jsonb('production').notNullable();
      table.jsonb('resources').notNullable();
      table.jsonb('units').notNullable();
      table.jsonb('buildings').notNullable();
      table.integer('playerId').unsigned().references('id').inTable('Player');
      table.bigInteger('createdAt').unsigned().notNullable();
      table.bigInteger('updatedAt').unsigned().notNullable();
    })
    .createTable('BuildingQueue', table => {
      table.increments('id').primary();
      table.string('name').notNullable();
      table.integer('level').unsigned().notNullable();
      table.integer('buildTime').unsigned().notNullable();
      table.bigInteger('endsAt').unsigned().notNullable();
      table.integer('townId').unsigned().references('id').inTable('Town');
      table.bigInteger('createdAt').unsigned().notNullable();
      table.bigInteger('updatedAt').unsigned().notNullable();
    })
    .createTable('UnitQueue', table => {
      table.increments('id').primary();
      table.string('name').notNullable();
      table.integer('amount').unsigned().notNullable();
      table.integer('recruitTime').unsigned().notNullable();
      table.bigInteger('endsAt').unsigned().notNullable();
      table.integer('townId').unsigned().references('id').inTable('Town');
      table.bigInteger('createdAt').unsigned().notNullable();
      table.bigInteger('updatedAt').unsigned().notNullable();
    })
    .createTable('Movement', table => {
      table.increments('id').primary();
      table.jsonb('units').notNullable();
      table.jsonb('haul');
      table.integer('type').unsigned().notNullable();
      table.bigInteger('endsAt').unsigned().notNullable();
      table.integer('originTownId').unsigned().references('id').inTable('Town');
      table.integer('targetTownId').unsigned().references('id').inTable('Town');
      table.bigInteger('createdAt').unsigned().notNullable();
      table.bigInteger('updatedAt').unsigned().notNullable();
    })
    .createTable('Report', table => {
      table.increments('id').primary();
      table.integer('outcome').unsigned().notNullable();
      table.jsonb('origin');
      table.jsonb('target');
      table.jsonb('haul');
      table.specificType('loyaltyChange', 'jsonb[]');
      table.integer('originTownId').unsigned().references('id').inTable('Town');
      table.integer('targetTownId').unsigned().references('id').inTable('Town');
      table.integer('originPlayerId').unsigned().references('id').inTable('Player');
      table.integer('targetPlayerId').unsigned().references('id').inTable('Player');
      table.bigInteger('createdAt').unsigned().notNullable();
      table.bigInteger('updatedAt').unsigned().notNullable();
    })
    .createTable('Alliance', table => {
      table.increments('id').primary();
      table.string('name').unique();
      table.bigInteger('createdAt').unsigned().notNullable();
      table.bigInteger('updatedAt').unsigned().notNullable();
    })
    .createTable('AllianceRole', table => {
      table.increments('id').primary();
      table.string('name').notNullable();
      table.jsonb('permissions').notNullable();
      table.integer('allianceId').unsigned().references('id').inTable('Alliance').onDelete('CASCADE');
      table.bigInteger('createdAt').unsigned().notNullable();
      table.bigInteger('updatedAt').unsigned().notNullable();
    })
    .table('Alliance', table => {
      table.integer('defaultRoleId').unsigned().references('id').inTable('AllianceRole').onDelete('CASCADE');
      table.integer('masterRoleId').unsigned().references('id').inTable('AllianceRole').onDelete('CASCADE');
    })
    .table('Player', table => {
      table.integer('allianceRoleId').unsigned().references('id').inTable('AllianceRole');
      table.integer('allianceId').unsigned().references('id').inTable('Alliance');
    })
    .createTable('AllianceMessage', table => {
      table.increments('id').primary();
      table.string('text').notNullable();
      table.integer('playerId').unsigned().references('id').inTable('Player');
      table.integer('allianceId').unsigned().references('id').inTable('Alliance').onDelete('CASCADE');
      table.bigInteger('createdAt').unsigned().notNullable();
      table.bigInteger('updatedAt').unsigned().notNullable();
    })
    .createTable('AllianceDiplomacy', table => {
      table.increments('id').primary();
      table.integer('type').unsigned().notNullable();
      table.integer('status').unsigned().notNullable();
      table.jsonb('data');
      table.integer('originAllianceId').unsigned().references('id').inTable('Alliance').onDelete('CASCADE');
      table.integer('targetAllianceId').unsigned().references('id').inTable('Alliance').onDelete('CASCADE');
      table.integer('originPlayerId').unsigned().references('id').inTable('Player');
      table.integer('targetPlayerId').unsigned().references('id').inTable('Player');
      table.bigInteger('createdAt').unsigned().notNullable();
      table.bigInteger('updatedAt').unsigned().notNullable();
    })
    .createTable('AllianceEvent', table => {
      table.increments('id').primary();
      table.integer('type').unsigned().notNullable();
      table.integer('status').unsigned().notNullable();
      table.integer('originAllianceId').unsigned().references('id').inTable('Alliance').onDelete('CASCADE');
      table.integer('targetAllianceId').unsigned().references('id').inTable('Alliance').onDelete('CASCADE');
      table.integer('originPlayerId').unsigned().references('id').inTable('Player');
      table.integer('targetPlayerId').unsigned().references('id').inTable('Player');
      table.bigInteger('createdAt').unsigned().notNullable();
      table.bigInteger('updatedAt').unsigned().notNullable();
    })
    .createTable('AllianceInvitation', table => {
      table.increments('id').primary();
      table
        .integer('playerId')
        .unsigned()
        .references('id')
        .inTable('Player')
        .onDelete('CASCADE');
      table
        .integer('allianceId')
        .references('id')
        .inTable('Alliance')
        .onDelete('CASCADE');
      // table.bigInteger('createdAt').unsigned().notNullable();
      // table.bigInteger('updatedAt').unsigned().notNullable();
    });
};

exports.down = function(knex, Promise) {
  return knex.schema
    .dropTableIfExists('Unit')
    .dropTableIfExists('Building')
    .dropTableIfExists('BuildingQueue')
    .dropTableIfExists('UnitQueue')
    .dropTableIfExists('Movement')
    .dropTableIfExists('Report')
    .dropTableIfExists('Town')
    .dropTableIfExists('AllianceEvent')
    .dropTableIfExists('AllianceMessage')
    .dropTableIfExists('AllianceDiplomacy')
    .dropTableIfExists('AllianceInvitation')
    .table('Alliance', table => {
      table.dropForeign('defaultRoleId');
      table.dropForeign('masterRoleId');
    })
    .table('Player', table => {
      table.dropForeign('allianceRoleId');
    })
    .dropTableIfExists('AllianceRole')
    .dropTableIfExists('Player')
    .dropTableIfExists('Alliance')
};
