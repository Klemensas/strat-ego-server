import { BaseModel } from '../../sqldb/baseModel';
import { Player } from '../player/player';
import { Message } from './message';

export class MessageState extends BaseModel {
  readonly id: number;
  read: boolean;

  // Associations
  playerId?: number;
  player?: Partial<Player>;
  messageId?: number;
  message?: Partial<Message>;

  static tableName = 'MessageState';

  static relationMappings = {
    player: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: 'player',
      join: {
        from: 'MessageState.playerId',
        to: 'Player.id',
      },
    },
    message: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: 'message',
      join: {
        from: 'MessageState.messageId',
        to: 'Message.id',
      },
    },
  };

  static jsonSchema = {
    type: 'object',
    required: ['read'],

    properties: {
      id: { type: 'integer' },
      read: { type: 'boolean' },
    },
  };
}
