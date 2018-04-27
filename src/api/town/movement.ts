import { Requirements, Resources, AttackType, Combat, MovementType, Dict } from 'strat-ego-common';

import { BaseModel } from '../../sqldb/baseModel';
import { Town } from './town';

export class Movement extends BaseModel {
  readonly id: number;
  units: Dict<number>;
  haul: Resources;
  type: MovementType;
  endsAt: number;

  // Associations
  originTownId?: number;
  originTown: Partial<Town>;
  targetTownId?: number;
  targetTown: Partial<Town>;
  static tableName = 'Movement';

  static relationMappings = {
    originTown: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: 'town',
      join: {
        from: 'Movement.originTownId',
        to: 'Town.id',
      },
    },
    targetTown: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: 'town',
      join: {
        from: 'Movement.targetTownId',
        to: 'Town.id',
      },
    },
  };

  static jsonSchema = {
    type: 'object',
    required: ['units', 'type', 'endsAt'],

    properties: {
      units: {
        type: 'object',
        patternProperties: {
          '.*': { type: 'integer' },
        },
      },
      haul: {
        type: ['object', 'null'],
        properties: {
          wood: { type: 'number' },
          clay: { type: 'number' },
          iron: { type: 'number' },
        },
      },
      type: { type: 'integer' },
      endsAt: { type: 'integer' },
    },
  };
}
