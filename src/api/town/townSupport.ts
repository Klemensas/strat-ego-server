import { Requirements, Resources, AttackType, Combat, MovementType, Dict } from 'strat-ego-common';

import { BaseModel } from '../../sqldb/baseModel';
import { Town } from './town';

export class TownSupport extends BaseModel {
  readonly id: number;
  units: Dict<number>;

  // Associations
  originTownId?: number;
  originTown: Partial<Town>;
  targetTownId?: number;
  targetTown: Partial<Town>;

  static tableName = 'TownSupport';
  static relationMappings = {
    originTown: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: 'town',
      join: {
        from: 'TownSupport.originTownId',
        to: 'Town.id',
      },
    },
    targetTown: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: 'town',
      join: {
        from: 'TownSupport.targetTownId',
        to: 'Town.id',
      },
    },
  };

  static jsonSchema = {
    type: 'object',
    required: ['units'],

    properties: {
      units: {
        type: 'object',
        patternProperties: {
          '.*': { type: 'integer' },
        },
      },
    },
  };
}
