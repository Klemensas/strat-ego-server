import { BaseModel } from '../../sqldb/baseModel';
import { Alliance } from './alliance.model';
import { Player } from '../player/player';

export class AllianceMessage extends BaseModel {
  readonly id: number;
  text: string;

  // Associations
  playerId?: number;
  player?: Partial<Player>;
  allianceId?: number;
  alliance?: Partial<Alliance>;

  static tableName = 'AllianceMessage';

  static relationMappings = {
    player: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: 'Player',
      join: {
        from: 'AllianceMessage.playerId',
        to: 'Player.id',
      },
    },
    alliance: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: 'Alliance',
      join: {
        from: 'AllianceMessage.allianceId',
        to: 'Alliance.id',
      },
    },
  };

  static jsonSchema = {
    type: 'object',
    required: ['text'],

    properties: {
      id: { type: 'integer' },
      text: { type: 'string' },
    },
  };
}
