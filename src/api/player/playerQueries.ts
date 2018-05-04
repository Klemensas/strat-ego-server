import * as Knex from 'knex';
import { Transaction } from 'objection';

import { knexDb } from '../../sqldb';
import { Player } from './player';
import { Town } from '../town/town';
import { Coords } from 'strat-ego-common';
import { UserWorld } from '../user/userWorld';

export function getPlayer(where: Partial<Player>, connection: Transaction | Knex = knexDb.world) {
  return Player
    .query(connection)
    .findOne(where);
}

export function getPlayerByName(name: string, connection: Transaction | Knex = knexDb.world) {
  return Player
    .query(connection)
    .findOne('name', 'ilike', name);
}

export function getFullPlayer(where: Partial<Player>, connection: Transaction | Knex = knexDb.world) {
  return getPlayer(where, connection)
    .eager(`[
      alliance(fullAlliance),
      allianceRole,
      originReports.[originTown, targetTown],
      targetReports.[originTown, targetTown],
      towns.${Town.townRelationsFiltered},
      invitations(selectAllianceProfile)
    ]`, Town.townRelationFilters)
    .modifyEager(`[
      originReports.[originTown,targetTown],
      targetReports.[originTown, targetTown]
    ]`, (builder) => builder.select('id', 'name', 'location'));
}

export function getPlayerWithInvites(where: Partial<Player>, connection: Transaction | Knex = knexDb.world) {
  return getPlayer(where, connection)
    .eager('invitations(selectAllianceProfile)');
}

export function getPlayerRankings(connection: Transaction | Knex = knexDb.world) {
  return Player
    .query(connection)
    .select(
      'id',
      'name',
      Player.relatedQuery('towns')
        .sum('score')
        .as('score'),
    )
    .orderBy('score', 'desc');
}

export async function createPlayer(
  name: string,
  location: Coords,
  userId: number,
  worldName: string,
  worldConnection: Transaction | Knex = knexDb.world,
  mainConnection: Transaction | Knex = knexDb.main,
) {
  const player = await Player
    .query(worldConnection)
    .insertGraph({
      name,
      userId,
      towns: [{
        name: `${name}s Town`,
        location,
      }],
    } as Partial<Player>);
  await UserWorld
    .query(mainConnection)
    .insert({
      userId,
      worldName,
      playerId: player.id,
    });
  return player;
}

export function createPlayerTown(player: Player, location: Coords, connection: Transaction | Knex = knexDb.world) {
  return player
    .$relatedQuery<Town>('towns', connection)
    .insert({
      location,
      name: `${player.name}s Town`,
    });
}
