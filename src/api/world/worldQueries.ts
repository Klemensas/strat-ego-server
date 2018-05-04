import { Transaction } from 'objection';
import * as Knex from 'knex';

import { knexDb } from '../../sqldb';
import { World } from './world';
import { Building } from '../building/building';
import { Unit } from '../unit/unit';
import { BuildingQueue } from '../building/buildingQueue';
import { Movement } from '../town/movement';
import { UnitQueue } from '../unit/unitQueue';

export function getWorld(name: string, connection: Transaction | Knex = knexDb.main) {
  return World
    .query(connection)
    .findById(name);
}

export function getBuildings(connection: Transaction | Knex = knexDb.world) {
  return Building
    .query(connection);
}

export function getUnits(connection: Transaction | Knex = knexDb.world) {
  return Unit
  .query(connection);
}

export function updateWorld(world: World, payload: Partial<World>, connection: Transaction | Knex = knexDb.main) {
  return world
    .$query(connection)
    .patch(payload);
}

export function getSortedBuildingQueues(connection: Transaction | Knex = knexDb.world) {
  return BuildingQueue
    .query(connection)
    .orderBy('endsAt', 'asc');
}

export function getSortedUnitQueues(connection: Transaction | Knex = knexDb.world) {
  return UnitQueue
    .query(connection)
    .orderBy('endsAt', 'asc');
}

export function getSortedMovements(connection: Transaction | Knex = knexDb.world) {
  return Movement
    .query(connection)
    .orderBy('endsAt', 'asc');
}
