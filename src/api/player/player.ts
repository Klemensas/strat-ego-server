import * as Knex from 'knex';

import { knexDb } from '../../sqldb';
import { BaseModel } from '../../sqldb/baseModel';
import { Town } from '../town/town';
import { Alliance } from '../alliance/alliance';
import { AllianceRole } from '../alliance/allianceRole';

export class Player extends BaseModel {
  readonly id: number;
  userId: number;
  name: string;

  // Associations
  towns?: Town[];
  allianceId?: number;
  alliance?: Partial<Alliance>;
  allianceRoleId?: number;
  allianceRole?: Partial<AllianceRole>;
  invitations?: Array<Partial<Alliance[]>>;

  static tableName = 'Player';

  static relationMappings = {
    towns: {
      relation: BaseModel.HasManyRelation,
      modelClass: 'Town',
      join: {
        from: 'Player.id',
        to: 'Town.playerId',
      },
    },
    alliance: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: 'Alliance',
      join: {
        from: 'Player.allianceId',
        to: 'Alliance.id',
      },
    },
    allianceRole: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: 'AllianceRole',
      join: {
        from: 'Player.allianceRoleId',
        to: 'AllianceRole.id',
      },
    },
    invitations: {
      relation: BaseModel.ManyToManyRelation,
      modelClass: 'Alliance',
      join: {
        from: 'Player.id',
        through: {
          joinTable: 'AllianceInvitation',
          from: 'AllianceInvitation.playerId',
          to: 'AllianceInvitation.allianceId',
        },
        to: 'Alliance.id',
      },
    },
    originReports: {
      relation: BaseModel.HasManyRelation,
      modelClass: 'Report',
      join: {
        from: 'Player.id',
        to: 'Report.originPlayerId',
      },
    },
    targetReports: {
      relation: BaseModel.HasManyRelation,
      modelClass: 'Report',
      join: {
        from: 'Player.id',
        to: 'Report.targetPlayerId',
      },
    },
  };

  static jsonSchema = {
    type: 'object',
    required: ['name', 'userId'],

    properties: {
      id: { type: 'integer' },
      name: { type: 'string', unique: 'true' },
      userId: { type: 'integer', unique: 'true' },
    },
  };

  static getPlayer(where: Partial<Player>, trx: Knex.Transaction | Knex = knexDb.world) {
    return Player
      .query(trx)
      .findOne(where)
      .eager(`[
        alliance(fullAlliance),
        allianceRole,
        originReports.[originTown, targetTown],
        targetReports.[originTown, targetTown],
        towns.[buildingQueues, unitQueues, originMovements, targetMovements],
        invitations(selectAllianceProfile)
      ]`)
      .modifyEager(`[
        originReports.[originTown,targetTown],
        targetReports.[originTown, targetTown]
      ]`, (builder) => builder.select('id', 'name', 'location'));
      // .debug();
  }

  static get namedFilters() {
    return {
      selectProfile: (builder) => builder.select('id', 'name'),
      selectPlayerProfile: (builder) => builder.select('Player.id', 'name'),
      selectProfileRole: (builder) => builder.select('id', 'name').eager('allianceRole'),
    };
  }
}
