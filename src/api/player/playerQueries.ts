import * as Knex from 'knex';
import { Transaction } from 'objection';

import { knexDb } from '../../sqldb';
import { Player } from './player';
import { Town } from '../town/town';
import { Coords } from 'strat-ego-common';
import { UserWorld } from '../user/userWorld';
import { getFullAlliance } from '../alliance/allianceQueries';

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

// TODO: this is too complex, consider changing architecture to break this up
export async function getFullPlayer(where: Partial<Player>, connection: Transaction | Knex = knexDb.world) {
  const player = await getPlayer(where, connection)
    .eager(`[
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
  if (player && player.allianceId !== null) {
    player.alliance = await getFullAlliance({ id: player.allianceId }, connection);
  }
  return player;
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

export function getPlayerProfile(where: Partial<Player>, connection: Transaction | Knex = knexDb.world) {
  return getPlayer(where, connection)
    .eager('[alliance(selectProfile), towns(selectTownProfile)]')
    .select(['id', 'name', 'description', 'avatarUrl', 'createdAt']);
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

export async function updatePlayer(player: Player, payload: Partial<Player>, connection: Transaction | Knex = knexDb.world) {
  return player
    .$query(connection)
    .patch(payload);
}

export async function progressTutorial(playerId: number, connection: Transaction | Knex = knexDb.world) {
  return Player
    .query(connection)
    .where({ id: playerId })
    .increment('tutorialStage', 1);
}
