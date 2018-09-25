import * as Knex from 'knex';

import { BaseModel } from '../../sqldb/baseModel';
import { Town } from '../town/town';
import { Alliance } from '../alliance/alliance';
import { AllianceRole } from '../alliance/allianceRole';

export class Player extends BaseModel {
  readonly id: number;
  userId: number;
  name: string;
  description: string;
  avatarUrl: string;
  tutorialStage: number;

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
      modelClass: 'town',
      join: {
        from: 'Player.id',
        to: 'Town.playerId',
      },
    },
    alliance: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: 'alliance',
      join: {
        from: 'Player.allianceId',
        to: 'Alliance.id',
      },
    },
    allianceRole: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: 'allianceRole',
      join: {
        from: 'Player.allianceRoleId',
        to: 'AllianceRole.id',
      },
    },
    invitations: {
      relation: BaseModel.ManyToManyRelation,
      modelClass: 'alliance',
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
      modelClass: 'report',
      join: {
        from: 'Player.id',
        to: 'Report.originPlayerId',
      },
    },
    targetReports: {
      relation: BaseModel.HasManyRelation,
      modelClass: 'report',
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

  static get namedFilters() {
    return {
      selectId: (builder) => builder.select('id'),
      selectPlayerId: (builder) => builder.select('Player.id'),
      selectIdAndScore: (builder) => builder.select(
        'id',
        Player.relatedQuery('towns')
          .sum('score')
          .as('score'),
      ),
      selectIdAndRole: (builder) => builder.select('id', 'allianceRoleId'),
      selectProfile: (builder) => builder.select('id', 'name'),
      selectPlayerProfile: (builder) => builder.select('Player.id', 'name'),
      selectProfileRole: (builder) => builder.select('id', 'name').eager('allianceRole'),
    };
  }
}
