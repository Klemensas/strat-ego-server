import { BaseModel } from '../../sqldb/baseModel';

export class UserWorld extends BaseModel {
  readonly id: number;
  userId: number;
  worldName: string;
  playerId: number;

  static tableName = 'UserWorld';

  static jsonSchema = {
    type: 'object',
    required: ['userId'],

    properties: {
      id: { type: 'integer' },
      userId: { type: 'integer' },
    },
  };
}
