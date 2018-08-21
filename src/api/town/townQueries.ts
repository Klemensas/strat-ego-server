import { Transaction, raw } from 'objection';
import * as Knex from 'knex';
import { MovementType, Coords } from 'strat-ego-common';

import { knexDb } from '../../sqldb';
import { Town } from './town';
import { BuildingQueue } from '../building/buildingQueue';
import { UnitQueue } from '../unit/unitQueue';
import { TownSupport } from './townSupport';
import { Movement } from './movement';
import { Player } from '../player/player';
import { Alliance } from '../alliance/alliance';
import { Report } from './report';

export function getTowns(where: Partial<Town>, connection: Transaction | Knex = knexDb.world) {
  return Town
    .query(connection)
    .where(where);
}

export function getFullTown(where: Partial<Town>, connection: Transaction | Knex = knexDb.world) {
  return getTowns(where, connection)
    .limit(1)
    .first()
    .eager(Town.townRelationsFiltered, Town.townRelationFilters);
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
  const buildingQueue = await town
    .$relatedQuery<BuildingQueue>('buildingQueues', connection)
    .insert(payload);
  await town
    .$query(connection)
    .patch({
      resources: town.resources,
      buildings: town.buildings,
    })
    .context({ resourcesUpdated: true });

  return { town, buildingQueue };
}

export async function createUnitQueue(
  town: Town,
  payload: Array<Partial<UnitQueue>>,
  updatedAt: number = Date.now(),
  connection: Transaction | Knex = knexDb.world,
) {
  const unitQueue = await town
    .$relatedQuery<UnitQueue>('unitQueues', connection)
    .insert(payload);
  await town
    .$query(connection)
    .patch({
      resources: town.resources,
      units: town.units,
      updatedAt,
    })
    .context({ resourcesUpdated: true });

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
      originTown: { id: originTown.id, name: originTown.name, location: originTown.location },
      targetTownId: targetTown.id,
      targetTown: { id: targetTown.id, name: targetTown.name, location: targetTown.location },
    });

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

export async function deleteSupport(support: TownSupport, endsAt: number, connection: Transaction | Knex = knexDb.world) {
  const unitQueue = await support
    .$query(connection)
    .del();

  const movement = await Movement.query(connection).insert({
    units: support.units,
    originTownId: support.targetTownId,
    originTown: support.targetTown,
    targetTownId: support.originTownId,
    targetTown: support.originTown,
    type: MovementType.return,
    endsAt,
    haul: null,
  });
  return movement;
}

export function deleteAllTownSupport(town: Town, connection: Transaction | Knex = knexDb.world) {
  return town
    .$relatedQuery('targetSupport', connection)
    .del();
}

export function deleteTownSupport(town: Town, targetId: number, connection: Transaction | Knex = knexDb.world) {
  return deleteAllTownSupport(town, connection)
    .where('id', targetId);
}

export function updateTownSupport(town: Town, targetId: number, payload: Partial<TownSupport>, connection: Transaction | Knex = knexDb.world) {
  return town
    .$relatedQuery<TownSupport>('targetSupport', connection)
    .patch(payload)
    .where('id', targetId);
}

export function deleteMovement(movement: Movement, connection: Transaction | Knex = knexDb.world) {
  return movement
    .$query(connection)
    .del();
}

export function createReport(payload: Partial<Report>, connection: Transaction | Knex = knexDb.world) {
  return Report
    .query(connection)
    .insert(payload);
}
