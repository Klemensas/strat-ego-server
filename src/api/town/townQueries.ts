import * as Knex from 'knex';
import { Transaction, raw, Model } from 'objection';
import { MovementType, Coords } from 'strat-ego-common';

import { knexDb } from '../../sqldb';
import { Town } from './town';
import { BuildingQueue } from '../building/buildingQueue';
import { UnitQueue } from '../unit/unitQueue';
import { TownSupport } from './townSupport';
import { Movement } from './movement';
import { Player } from '../player/player';
import { Alliance } from '../alliance/alliance';
import { Report } from '../report/report';

export function getTowns(where: Partial<Town>, connection: Transaction | Knex = knexDb.world) {
  return Town
    .query(connection)
    .where(where);
}

export function getTown(where: Partial<Town>, connection: Transaction | Knex = knexDb.world) {
  return getTowns(where, connection)
    .first();
}

export function getTownsWithItems(where: Partial<Town>, connection: Transaction | Knex = knexDb.world) {
  return getTowns(where, connection)
    .eager(Town.townRelationsFilteredNoMovementUnits, Town.townRelationFilters);
}

export function getTownWithItems(where: Partial<Town>, connection: Transaction | Knex = knexDb.world) {
  return getTownsWithItems(where, connection)
    .first();
}

export function getTownSupport(id: number, connection: Transaction | Knex = knexDb.world) {
  return TownSupport
    .query(connection)
    .findById(id)
    .eager('[originTown(selectTownProfile), targetTown(selectTownProfile)]');
}

export function getTownLocationsByCoords(coords: Coords[], connection: Transaction | Knex = knexDb.world) {
  return Town
    .query(connection)
    .select('location')
    .innerJoin(raw(`(VALUES ${coords.map((coord) => `(array[${coord.join(', ')}])`).join(', ')}) location(l)`), 'l', 'Town.location');
}

export function getTownsMapProfile(connection: Transaction | Knex = knexDb.world) {
  return Town
    .query(connection)
    .select('id', 'name', 'location', 'score')
    .eager('[player.[alliance]]')
    .pick(Player, ['id', 'name', 'alliance'])
    .pick(Alliance, ['id', 'name']);
}

export function renameTown(name: string, id: number, connection: Transaction | Knex = knexDb.world) {
  return Town
    .query(connection)
    .patch({ name })
    .where({ id });
}

export function updateTown(town: Town, payload: Partial<Town>, context: object, connection: Transaction | Knex = knexDb.world) {
  return town
    .$query(connection)
    .patch(payload)
    .context(context);
}

export function upsertTowns(payload: Array<Partial<Town>>, context: object, connection: Transaction | Knex = knexDb.world) {
  return Town
    .query(connection)
    .upsertGraph(payload, { noDelete: true })
    .context(context);
}

export async function createBuildingQueue(town: Town, payload: Partial<BuildingQueue>, connection: Transaction | Knex = knexDb.world) {
  const [newTown, buildingQueue ] = await Promise.all([
    town
      .$query(connection)
      .patch({
        resources: town.resources,
        buildings: town.buildings,
      })
      .context({ resourcesUpdated: true }),
    BuildingQueue
      .query(connection)
      .insert(payload),
  ]);

  return { town, buildingQueue };
}

export async function createUnitQueue(
  town: Town,
  payload: Array<Partial<UnitQueue>>,
  updatedAt: number = Date.now(),
  connection: Transaction | Knex = knexDb.world,
) {
  const [newTown, unitQueue] = await Promise.all([
    town
      .$query(connection)
      .patch({
        resources: town.resources,
        units: town.units,
        updatedAt,
      })
      .context({ resourcesUpdated: true }),
    UnitQueue
      .query(connection)
      .insert(payload),
  ]);

  return { town, unitQueue };
}

export async function createMovement(
  originTown: Town,
  targetTown: Town,
  payload: Partial<Movement>,
  connection: Transaction | Knex = knexDb.world,
  patchOrigin: boolean = false,
) {
  const movement = await originTown
    .$relatedQuery<Movement>('originMovements', connection)
    .insert({
      ...payload,
      originTownId: originTown.id,
      targetTownId: targetTown.id,
    });
  movement.originTown = { id: originTown.id, name: originTown.name, location: originTown.location };
  movement.targetTown = { id: targetTown.id, name: targetTown.name, location: targetTown.location };

  if (patchOrigin) {
    await originTown
      .$query(connection)
      .patch({
        units: originTown.units,
      });
  }
  return { town: originTown, movement };
}

export function createSupport(payload: Partial<TownSupport>, connection: Transaction | Knex = knexDb.world) {
  return TownSupport
    .query(connection)
    .insert(payload);
}

export async function cancelSupport(support: TownSupport, endsAt: number, connection: Transaction | Knex = knexDb.world) {
  const [movement] = await Promise.all([
    Movement
      .query(connection)
      .insert({
        units: support.units,
        originTownId: support.targetTownId,
        targetTownId: support.originTownId,
        type: MovementType.return,
        endsAt,
        haul: null,
      }),
    support
      .$query(connection)
      .del(),
  ]);
  return movement;
}

export function updateStationedSupport(town: Town, targetId: number, payload: Partial<TownSupport>, connection: Transaction | Knex = knexDb.world) {
  return town
    .$relatedQuery<TownSupport>('targetSupport', connection)
    .patch(payload)
    .where('id', targetId);
}

export function deleteSupport(id: number[], connection: Transaction | Knex = knexDb.world) {
  if (!id.length) { return; }

  return TownSupport
    .query(connection)
    .whereIn('id', id)
    .del();
}

export function deleteMovement(id: number[], connection: Transaction | Knex = knexDb.world) {
  if (!id.length) { return; }

  return Movement
    .query(connection)
    .whereIn('id', id)
    .del();
}

export function deleteMovementItem(movement: Movement, connection: Transaction | Knex = knexDb.world) {
  return movement
    .$query(connection)
    .del();
}

export function createReport(payload: Partial<Report>, connection: Transaction | Knex = knexDb.world) {
  return Report
    .query(connection)
    .insert(payload);
}

export function getTownProfiles(ids: number[] = [], connection: Transaction | Knex = knexDb.world) {
  const query = Town
    .query(connection)
    .select(['id', 'name', 'location', 'score', 'playerId', 'createdAt']);

  // Filter by ids if any present
  if (ids.length) {
    query.whereIn('id', ids);
  }
  return query;
}

export function getLastTownBuildingQueue(townId: number, connection: Transaction | Knex = knexDb.world) {
  return BuildingQueue
    .query(connection)
    .orderBy('id', 'DESC')
    .findOne({ townId });
}

export function getLastTownUnitQueue(townId: number, connection: Transaction | Knex = knexDb.world) {
  return UnitQueue
    .query(connection)
    .orderBy('id', 'DESC')
    .findOne({ townId });
}
