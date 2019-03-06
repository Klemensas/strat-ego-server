import { BaseModel } from '../../sqldb/baseModel';
import { Player } from '../player/player';
import { Thread } from './thread';
import { MessageState } from './messageState';

export class Message extends BaseModel {
  readonly id: number;
  text: string;

  // Associations
  threadId?: number;
  thread?: Partial<Thread>;
  senderId?: number;
  sender?: Partial<Player>;
  states: Array<Partial<MessageState>>;

  static tableName = 'Message';

  static relationMappings = {
    thread: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: 'thread',
      join: {
        from: 'Message.threadId',
        to: 'Thread.id',
      },
    },
    sender: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: 'player',
      join: {
        from: 'Message.senderId',
        to: 'Player.id',
      },
    },
    states: {
      relation: BaseModel.HasManyRelation,
      modelClass: 'messageState',
      join: {
        from: 'Message.id',
        to: 'MessageState.messageId',
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
