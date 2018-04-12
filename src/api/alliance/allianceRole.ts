import { AlliancePermissions } from 'strat-ego-common';

import { BaseModel } from '../../sqldb/baseModel';
import { Alliance } from './alliance';
import { Player } from '../player/player';

export function setAlliancePermissions(permissions: Partial<AlliancePermissions> = {}): AlliancePermissions {
  return {
    viewInvites: false,
    editInvites: false,
    manageForum: false,
    editProfile: false,
    viewManagement: false,
    manageRoles: false,
    manageAlliance: false,
    ...permissions,
  };
}

export class  AllianceRole extends BaseModel {
  readonly id: number;
  name: string;
  permissions: AlliancePermissions;

  // Associations
  allianceId?: number;
  alliance?: Partial<Alliance>;
  players?: Array<Partial<Player>>;

  static tableName = 'AllianceRole';
  $beforeUpdate(queryContext) {
    super.$beforeInsert(queryContext);
  }
  $beforeInsert(queryContext) {
    super.$beforeInsert(queryContext);
  }
  static relationMappings = {
    alliance: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: 'alliance',
      join: {
        from: 'AllianceRole.allianceId',
        to: 'Alliance.id',
      },
    },
    defaultAllianceRole: {
      relation: BaseModel.HasOneRelation,
      modelClass: 'alliance',
      join: {
        from: 'AllianceRole.id',
        to: 'Alliance.defaultRoleId',
      },
    },
    masterAllianceRole: {
      relation: BaseModel.HasOneRelation,
      modelClass: 'alliance',
      join: {
        from: 'AllianceRole.id',
        to: 'Alliance.masterRoleId',
      },
    },
    players: {
      relation: BaseModel.HasManyRelation,
      modelClass: 'player',
      join: {
        from: 'AllianceRole.id',
        to: 'Player.allianceRoleId',
      },
    },
  };

  static jsonSchema = {
    type: 'object',
    required: ['name', 'permissions'],

    properties: {
      id: { type: 'integer' },
      name: { type: 'string' },
      permisions: { type: 'object' },
    },
  };
}
