import { Requirements, Resources } from 'strat-ego-common';

import { BaseModel } from '../../sqldb/baseModel';
import { Town } from '../town/town';

export class BuildingQueue extends BaseModel {
  readonly id: number;
  name: string;
  level: number;
  buildTime: number;
  endsAt: number;

  // Associations
  public townId?: number;
  public town: Partial<Town>;

  static tableName = 'BuildingQueue';

  static relationMappings = {
    town: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: 'Town',
      join: {
        from: 'BuildingQueue.townId',
        to: 'Town.id',
      },
    },
  };

  static jsonSchema = {
    type: 'object',

    properties: {
      name: { type: 'string' },
      level: { type: 'integer' },
      buildTime: { type: 'integer' },
      endsAt: { type: 'integer' },
    },
  };
}
