import { EventType, EventStatus } from 'strat-ego-common';

import { BaseModel } from '../../sqldb/baseModel';
import { Alliance } from './alliance';
import { Player } from '../player/player';

export class AllianceEvent extends BaseModel {
  readonly id: number;
  type: EventType;
  status: EventStatus;

  // Associations
  originAllianceId?: number;
  originAlliance?: Partial<Alliance>;
  targetAllianceId?: number;
  targetAlliance?: Partial<Alliance>;
  originPlayerId?: number;
  originPlayer?: Partial<Player>;
  targetPlayerId?: number;
  targetPlayer?: Partial<Player>;

  static tableName = 'AllianceEvent';

  static relationMappings = {
    originPlayer: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: 'player',
      join: {
        from: 'AllianceEvent.originPlayerId',
        to: 'Player.id',
      },
    },
    targetPlayer: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: 'player',
      join: {
        from: 'AllianceEvent.targetPlayerId',
        to: 'Player.id',
      },
    },
    originAlliance: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: 'alliance',
      join: {
        from: 'AllianceEvent.originAllianceId',
        to: 'Alliance.id',
      },
    },
    targetAlliance: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: 'alliance',
      join: {
        from: 'AllianceEvent.targetAllianceId',
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
    },
  };
}
