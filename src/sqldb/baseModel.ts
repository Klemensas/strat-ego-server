import * as path from 'path';
import * as fs from 'fs';
import { Model, Constructor, Transaction, QueryBuilder } from 'objection';
import * as dbErrors from 'db-errors';
import * as knex from 'knex';

class DbErrors extends Model {
  static query<QM extends Model>(
    this: Constructor<QM>,
    trxOrKnex?: Transaction | knex,
  ): QueryBuilder<QM> {
    return super.query.apply(this, arguments).onError((err) => Promise.reject(dbErrors.wrapError(err)));
  }
}

export class BaseModel extends DbErrors {
  '#id'?: string;
  '#ref'?: string;
  '#dbRef'?: string;

  createdAt?: number;
  updatedAt?: number;

  static get modelPaths() {
    const base = path.join(__dirname, '..', 'api');
    return fs.readdirSync(path.join(__dirname, '..', 'api')).map((folder) => path.join(base, folder));
  }

  $beforeValidate(jsonSchema, json, opt) {
    jsonSchema.properties.createdAt = { type: ['integer', 'string'] };
    jsonSchema.properties.updatedAt = { type: ['integer', 'string'] };

    return jsonSchema;
  }

  $beforeInsert(queryContext) {
    const date = Date.now();
    this.createdAt = date;
    this.updatedAt = date;
  }

  $beforeUpdate(opt, queryContext) {
    this.updatedAt = Date.now();
  }
}
