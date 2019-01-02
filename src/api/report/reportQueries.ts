import * as Knex from 'knex';
import { Transaction } from 'objection';
import { knexDb } from '../../sqldb';
import { Report } from './report';

export function getPlayerReports(playerId: number, connection: Transaction | Knex = knexDb.world) {
  return Report
    .query(connection)
    .where({ originPlayerId: playerId })
    .orWhere({ targetPlayerId: playerId })
    .orderBy('createdAt', 'DESC')
    .limit(50);
}
