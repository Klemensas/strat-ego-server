import * as Knex from 'knex';
import { Transaction } from 'objection';

import { knexDb } from '../../sqldb';
import { User } from './user';

export function getUser(where: Partial<User>, connection: Transaction | Knex = knexDb.main) {
  return User
    .query(connection)
    .findOne(where)
    .select('id', 'name', 'email', 'role', 'provider', 'createdAt', 'updatedAt')
}

export function getFullUser(where: Partial<User>, connection: Transaction | Knex = knexDb.main) {
  return getUser(where, connection)
    .eager('worlds');
}

export function getUsers(connection: Transaction | Knex = knexDb.main) {
  return User
    .query(connection)
    .select('id', 'name', 'email', 'role', 'provider', 'createdAt', 'updatedAt')
}

export function getUserByEmail(email: string, connection: Transaction | Knex = knexDb.main) {
  return User
    .query(connection)
    .findOne('email', email.toLowerCase());
}

export function deleteUser(id: number, connection: Transaction | Knex = knexDb.main) {
  return User
    .query(connection)
    .deleteById(id);
}

export function createUser(name: string, email: string, password: string, connection: Transaction | Knex = knexDb.main) {
  return User
    .query(connection)
    .insert({
      name,
      email,
      password,
      provider: 'local',
      role: 'member',
    });
}

export function changePassword(user: User, password: string, connection: Transaction | Knex = knexDb.main) {
  return user
    .$query(connection)
    .patch({
      password,
    });
}
