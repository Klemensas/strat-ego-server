import { Resources, CombatCasualties, Haul, CombatOutcome } from 'strat-ego-common';

import { BaseModel } from '../../sqldb/baseModel';
import { Town } from './town';
import { Player } from '../player/player';

export class Report extends BaseModel {
  readonly id: number;
  outcome: CombatOutcome;
  origin: CombatCasualties;
  target: CombatCasualties;
  haul: Haul;
  loyaltyChange: number[];

  // Associations
  originTownId?: number;
  originTown: Partial<Town>;
  targetTownId?: number;
  targetTown: Partial<Town>;
  originPlayerId?: number;
  originPlayer: Partial<Player>;
  targetPlayerId?: number;
  targetPlayer: Partial<Player>;

  static tableName = 'Report';

  static relationMappings = {
    originTown: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: 'town',
      join: {
        from: 'Report.originTownId',
        to: 'Town.id',
      },
    },
    targetTown: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: 'town',
      join: {
        from: 'Report.targetTownId',
        to: 'Town.id',
      },
    },
    originPlayer: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: 'player',
      join: {
        from: 'Report.originPlayerId',
        to: 'Player.id',
      },
    },
    targetPlayer: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: 'player',
      join: {
        from: 'Report.targetPlayerId',
        to: 'Player.id',
      },
    },
  };

  static jsonSchema = {
    type: 'object',
    required: ['outcome', 'origin', 'target'],

    properties: {
      outcome: { type: 'integer' },
      origin: {
        type: 'object',
        units: {
          patternProperties: {
            '.*': { type: 'integer' },
          },
        },
        losses: {
          patternProperties: {
            '.*': { type: 'integer' },
          },
        },
      },
      target: {
        type: 'object',
        units: {
          patternProperties: {
            '.*': { type: 'integer' },
          },
        },
        losses: {
          patternProperties: {
            '.*': { type: 'integer' },
          },
        },
      },
      haul: {
        type: 'object',
        properties: {
          maxHaul: { type: 'number' },
          haul: {
            type: 'object',
            properties: {
              wood: { type: 'number' },
              clay: { type: 'number' },
              iron: { type: 'number' },
            },
          },
        },
      },
      // loyaltyChange: {
      //   type: 'array',
      //   items: {
      //     type: 'integer',
      //   },
      // },
    },
  };
}
