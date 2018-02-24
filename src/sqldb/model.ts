import * as path from 'path';
import * as fs from 'fs';
import { Model } from 'objection';


export class BaseModel extends Model {
  timestamps?: boolean;
  createdAt?: string;
  updatedAt?: string;

  static get modelPaths() {
    const base = path.join(__dirname, '..', 'api');
    return fs.readdirSync(path.join(__dirname, '..', 'api')).map((folder) => path.join(base, folder));
  };

  $beforeValidate (jsonSchema, json, opt) {
    if (this.timestamps) {
      jsonSchema.properties.createdAt = {type: 'string'};
      jsonSchema.properties.updatedAt = {type: 'string'};
    }


    return jsonSchema;
  }

  $beforeInsert(queryContext) {
    if (this.timestamps) {
      const date = new Date().toISOString();
      this.createdAt = date;
      this.updatedAt = date;
    }
  }

  $beforeUpdate(opt, queryContext) {
    if (this.timestamps) {
      this.updatedAt = new Date().toISOString();
    }
  }
}
