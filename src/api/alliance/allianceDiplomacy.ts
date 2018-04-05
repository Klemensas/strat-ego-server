import { DiplomacyType, DiplomacyStatus } from 'strat-ego-common';

import { BaseModel } from '../../sqldb/baseModel';
import { Alliance } from './alliance';
import { Player } from '../player/player';

export class AllianceDiplomacy extends BaseModel {
  readonly id: number;
  type: DiplomacyType;
  status: DiplomacyStatus;
  data?: any;

  // Associations
  originAllianceId?: number;
  originAlliance?: Partial<Alliance>;
  targetAllianceId?: number;
  targetAlliance?: Partial<Alliance>;
  originPlayerId?: number;
  originPlayer?: Partial<Player>;
  targetPlayerId?: number;
  targetPlayer?: Partial<Player>;

  static tableName = 'AllianceDiplomacy';

  static relationMappings = {
    originPlayer: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: 'Player',
      join: {
        from: 'AllianceDiplomacy.originPlayerId',
        to: 'Player.id',
      },
    },
    targetPlayer: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: 'Player',
      join: {
        from: 'AllianceDiplomacy.targetPlayerId',
        to: 'Player.id',
      },
    },
    originAlliance: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: 'Alliance',
      join: {
        from: 'AllianceDiplomacy.originAllianceId',
        to: 'Alliance.id',
      },
    },
    targetAlliance: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: 'Alliance',
      join: {
        from: 'AllianceDiplomacy.targetAllianceId',
        to: 'Alliance.id',
      },
    },
  };

  static jsonSchema = {
    type: 'object',
    required: ['type', 'status'],

    properties: {
      id: { type: 'integer' },
      type: { type: 'integer' },
      status: { type: 'integer' },
      data: { type: 'object' },
    },
  };
}
