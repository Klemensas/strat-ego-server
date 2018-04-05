import * as path from 'path';
import * as fs from 'fs';
import { Model } from 'objection';

export class BaseModel extends Model {
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
