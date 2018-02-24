import { BaseModel } from '../../sqldb/model';

export class UserWorld extends BaseModel {
  readonly id: number;
  userId: number;
  worldName: string;
  playerId: number;

  static tableName = 'UserWorld';
}
