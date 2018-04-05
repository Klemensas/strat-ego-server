import { Requirements, Resources } from 'strat-ego-common';

import { BaseModel } from '../../sqldb/baseModel';
import { Town } from '../town/town';

export class UnitQueue extends BaseModel {
  readonly id: number;
  name: string;
  amount: number;
  recruitTime: number;
  endsAt: number;

  // Associations
  public townId?: number;
  public town: Partial<Town>;

  static tableName = 'UnitQueue';

  static relationMappings = {
    town: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: 'Town',
      join: {
        from: 'UnitQueue.townId',
        to: 'Town.id',
      },
    },
  };

  static jsonSchema = {
    type: 'object',

    properties: {
      name: { type: 'string' },
      amount: { type: 'integer' },
      recruitTime: { type: 'integer' },
      endsAt: { type: 'integer' },
    },
  };
}
