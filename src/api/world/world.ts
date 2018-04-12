import { ValidationError } from 'objection';

import { BaseModel } from '../../sqldb/baseModel';
import { User } from '../user/user';

export class World extends BaseModel {
  readonly name: string;
  baseProduction: number;
  speed: number;
  size: number;
  regionSize: number;
  fillTime: number;
  fillPercent: number;
  barbPercent: number;
  timeQouta: number;
  generationArea: number;
  currentRing: number;
  initialLoyalty: number;
  loyaltyRegeneration: number;
  loyaltyReductionRange: [number, number];
  expansionRate: number;
  expansionGrowth: number;
  lastExpansion: number;
  townGrowthInterval: number;
  townLastGrowth: number;

  // Associations
  users?: Array<Partial<User[]>>;

  static tableName = 'World';
  static idColumn = 'name';

  static relationMappings = {
    users: {
      relation: BaseModel.ManyToManyRelation,
      modelClass: 'user',
      join: {
        from: 'World.name',
        through: {
          modelClass: 'userWorld',
          from: 'UserWorld.worldName',
          to: 'UserWorld.userId',
        },
        to: 'User.id',
      },
    },
  };

  static jsonSchema = {
    type: 'object',
    required: [
    'name',
    'baseProduction',
    'speed',
    'size',
    'regionSize',
    'fillTime',
    'fillPercent',
    'barbPercent',
    'timeQouta',
    'generationArea',
    'currentRing',
    'initialLoyalty',
    'loyaltyRegeneration',
    'loyaltyReductionRange',
    'expansionRate',
    'expansionGrowth',
    'lastExpansion',
    'townGrowthInterval',
    'townLastGrowth',
  ],

    properties: {
      name: { type: 'string' },
      baseProduction: { type: 'integer' },
      speed: { type: 'integer' },
      size: { type: 'integer' },
      regionSize: { type: 'integer' },
      fillTime: { type: 'bigint' },
      fillPercent: { type: 'float' },
      barbPercent: { type: 'float' },
      timeQouta: { type: 'float' },
      generationArea: { type: 'integer' },
      currentRing: { type: 'integer' },
      initialLoyalty: { type: 'integer' },
      loyaltyRegeneration: { type: 'integer' },
      expansionRate: { type: 'integer' },
      expansionGrowth: { type: 'number' },
      lastExpansion: { type: 'integer' },
      townGrowthInterval: { type: 'integer' },
      townLastGrowth: { type: 'integer' },

      // loyaltyReductionRange: {
      //   type: 'array',
      //   minItems: 2,
      //   maxItems: 2,
      // },
    },
  };

  $beforeInsert(queryContext) {
    super.$beforeInsert(queryContext);
    if (!(this.size % 2)) {
      throw new ValidationError({
        message: 'World size must be an odd number',
        type: 'WorldSize',
        data: this,
      });
    }
    if (this.size % this.regionSize) {
      throw new ValidationError({
        message: 'World size must be divisable by region size',
        type: 'WorldRegionSize',
        data: this,
      });
    }
  }
}
