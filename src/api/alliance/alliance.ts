import * as Knex from 'knex';

import { knexDb } from '../../sqldb';
import { BaseModel } from '../../sqldb/baseModel';
import { AllianceRole } from './allianceRole';
import { AllianceDiplomacy } from './allianceDiplomacy';
import { AllianceMessage } from './allianceMessage';
import { Player } from '../player/player';
import { AllianceEvent } from './allianceEvent';

export class Alliance extends BaseModel {
  readonly id: number;
  name: string;
  description: string;
  avatarUrl: string;

  // Associations
  roles?: Array<AllianceRole | Partial<AllianceRole>>;
  defaultRoleId?: number;
  defaultRole?: Partial<AllianceRole>;
  masterRoleId?: number;
  masterRole?: Partial<AllianceRole>;
  members?: Array<Partial<Player>>;
  invitations?: Array<Partial<Player>>;
  diplomacyOrigin?: Array<Partial<AllianceDiplomacy>>;
  diplomacyTarget?: Array<Partial<AllianceDiplomacy>>;
  eventOrigin?: Array<Partial<AllianceEvent>>;
  eventTarget?: Array<Partial<AllianceEvent>>;
  events?: Array<Partial<AllianceEvent>>;
  messages?: Array<Partial<AllianceMessage>>;

  static tableName = 'Alliance';

  static relationMappings = {
    roles: {
      relation: BaseModel.HasManyRelation,
      modelClass: 'allianceRole',
      join: {
        from: 'Alliance.id',
        to: 'AllianceRole.allianceId',
      },
    },
    members: {
      relation: BaseModel.HasManyRelation,
      modelClass: 'player',
      join: {
        from: 'Alliance.id',
        to: 'Player.allianceId',
      },
    },
    invitations: {
      relation: BaseModel.ManyToManyRelation,
      modelClass: 'player',
      join: {
        from: 'Alliance.id',
        through: {
          joinTable: 'AllianceInvitation',
          from: 'AllianceInvitation.allianceId',
          to: 'AllianceInvitation.playerId',
        },
        to: 'Player.id',
      },
    },
    defaultRole: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: 'allianceRole',
      join: {
        from: 'Alliance.defaultRoleId',
        to: 'AllianceRole.id',
      },
    },
    masterRole: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: 'allianceRole',
      join: {
        from: 'Alliance.masterRoleId',
        to: 'AllianceRole.id',
      },
    },
    diplomacyOrigin: {
      relation: BaseModel.HasManyRelation,
      modelClass: 'allianceDiplomacy',
      join: {
        from: 'Alliance.id',
        to: 'AllianceDiplomacy.originAllianceId',
      },
    },
    diplomacyTarget: {
      relation: BaseModel.HasManyRelation,
      modelClass: 'allianceDiplomacy',
      join: {
        from: 'Alliance.id',
        to: 'AllianceDiplomacy.targetAllianceId',
      },
    },
    eventOrigin: {
      relation: BaseModel.HasManyRelation,
      modelClass: 'allianceEvent',
      join: {
        from: 'Alliance.id',
        to: 'AllianceEvent.originAllianceId',
      },
    },
    eventTarget: {
      relation: BaseModel.HasManyRelation,
      modelClass: 'allianceEvent',
      join: {
        from: 'Alliance.id',
        to: 'AllianceEvent.targetAllianceId',
      },
    },
    messages: {
      relation: BaseModel.HasManyRelation,
      modelClass: 'allianceMessage',
      join: {
        from: 'Alliance.id',
        to: 'AllianceMessage.allianceId',
      },
    },
  };

  static jsonSchema = {
    type: 'object',
    required: ['name'],

    properties: {
      id: { type: 'integer' },
      name: { type: 'string', unique: 'true' },
    },
  };

  static get namedFilters() {
    return {
      selectId: (builder) => builder.select('id'),
      selectProfile: (builder) => builder.select('id', 'name'),
      selectAllianceProfile: (builder) => builder.select('Alliance.id', 'name'),
      fullAlliance: (builder) => builder
        .eager(`[
          roles,
          defaultRole,
          masterRole,
          members(selectProfileRole),
          invitations(selectPlayerProfile)
          diplomacyOrigin.[originAlliance(selectProfile), targetAlliance(selectProfile), originPlayer(selectProfile), targetPlayer(selectProfile)],
          diplomacyTarget.[originAlliance(selectProfile), targetAlliance(selectProfile), originPlayer(selectProfile), targetPlayer(selectProfile)],
          messages.[player(selectProfile)]
        ]`),
      selectBase: (builder) => builder.eager(`[
        roles,
        invitations(selectPlayerId),
        members(selectIdAndRole),
      ]`),
    };
  }
}
