import { BaseModel } from '../../sqldb/baseModel';
import { Player } from '../player/player';
import { Message } from './message';

export class Thread extends BaseModel {
  readonly id: number;
  title: string;

  // Associations
  participants?: Array<Partial<Player>>;
  messages?: Array<Partial<Message>>;

  static tableName = 'Thread';

  static relationMappings = {
    participants: {
      relation: BaseModel.ManyToManyRelation,
      modelClass: 'player',
      join: {
        from: 'Thread.id',
        through: {
          from: 'ThreadParticipant.threadId',
          to: 'ThreadParticipant.playerId',
        },
        to: 'Player.id',
      },
    },
    messages: {
      relation: BaseModel.HasManyRelation,
      modelClass: 'message',
      join: {
        from: 'Thread.id',
        to: 'Message.threadId',
      },
    },
  };

  static jsonSchema = {
    type: 'object',
    required: ['title'],

    properties: {
      id: { type: 'integer' },
      title: { type: 'string' },
    },
  };
}
