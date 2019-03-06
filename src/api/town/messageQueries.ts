import { Transaction, QueryBuilder } from 'objection';
import * as Knex from 'knex';
import { Paged } from 'strat-ego-common';

import * as config from '../../config/environment';
import { knexDb } from '../../sqldb';
import { Thread } from '../message/thread';

export function getPlayerThreads(playerId: number, connection: Transaction | Knex = knexDb.world) {
  return Thread
    .query(connection)
    .joinRelation('participants')
    .where('participants.id', playerId)
}

export async function getPagedPlayerThreads(
  playerId: number,
  page: number = 1,
  pageSize: number = config.defaultPageSize,
  connection: Transaction | Knex = knexDb.world,
): Promise<Paged<Partial<Thread>>> {
  const threads = await getPlayerThreads(playerId, connection)
    .orderBy('createdAt', 'DESC')
    .page(page, pageSize)
    .eager('[participants(selectPlayerId), messages.states]');
  return { ...threads, pageSize };
}

export function createThread(thread: Partial<Thread>, connection: Transaction | Knex = knexDb.world) {
  const message = { ...thread.messages[0] };
  message.states = thread.participants.map(({ id }) => ({ playerId: id, read: message.senderId !== id }));

  return Thread
    .query(connection)
    .insertGraph({
      ...thread,
      participants: thread.participants.map(({ id }) => ({ id })),
      messages: [message],
    }, {
      relate: true,
    });
}
