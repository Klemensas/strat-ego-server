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
  messages?: Array<Partial<AllianceMessage>>;

  static tableName = 'Alliance';

  static relationMappings = {
    roles: {
      relation: BaseModel.HasManyRelation,
      modelClass: 'AllianceRole',
      join: {
        from: 'Alliance.id',
        to: 'AllianceRole.allianceId',
      },
    },
    members: {
      relation: BaseModel.HasManyRelation,
      modelClass: 'Player',
      join: {
        from: 'Alliance.id',
        to: 'Player.allianceId',
      },
    },
    invitations: {
      relation: BaseModel.ManyToManyRelation,
      modelClass: 'Player',
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
      modelClass: 'AllianceRole',
      join: {
        from: 'Alliance.defaultRoleId',
        to: 'AllianceRole.id',
      },
    },
    masterRole: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: 'AllianceRole',
      join: {
        from: 'Alliance.masterRoleId',
        to: 'AllianceRole.id',
      },
    },
    diplomacyOrigin: {
      relation: BaseModel.HasManyRelation,
      modelClass: 'AllianceDiplomacy',
      join: {
        from: 'Alliance.id',
        to: 'AllianceDiplomacy.originAllianceId',
      },
    },
    diplomacyTarget: {
      relation: BaseModel.HasManyRelation,
      modelClass: 'AllianceDiplomacy',
      join: {
        from: 'Alliance.id',
        to: 'AllianceDiplomacy.targetAllianceId',
      },
    },
    eventOrigin: {
      relation: BaseModel.HasManyRelation,
      modelClass: 'AllianceEvent',
      join: {
        from: 'Alliance.id',
        to: 'AllianceEvent.originAllianceId',
      },
    },
    eventTarget: {
      relation: BaseModel.HasManyRelation,
      modelClass: 'AllianceEvent',
      join: {
        from: 'Alliance.id',
        to: 'AllianceEvent.targetAllianceId',
      },
    },
    messages: {
      relation: BaseModel.HasManyRelation,
      modelClass: 'AllianceMessage',
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
      selectProfile: (builder) => builder.select('id', 'name'),
      selectAllianceProfile: (builder) => builder.select('Alliance.id', 'name'),
      fullAlliance: (builder) => builder.eager(`[
        roles,
        defaultRole,
        masterRole,
        members(selectProfileRole),
        invitations(selectPlayerProfile)
        diplomacyOrigin.[originAlliance(selectProfile), targetAlliance(selectProfile), originPlayer(selectProfile), targetPlayer(selectProfile)],
        diplomacyTarget.[originAlliance(selectProfile), targetAlliance(selectProfile), originPlayer(selectProfile), targetPlayer(selectProfile)],
        eventOrigin.[originAlliance(selectProfile), targetAlliance(selectProfile), originPlayer(selectProfile), targetPlayer(selectProfile)],
        eventTarget.[originAlliance(selectProfile), targetAlliance(selectProfile), originPlayer(selectProfile), targetPlayer(selectProfile)],
        messages.[player(selectProfile)]
      ]`),
    };
  }

  static getAlliance(where: Partial<Player>, trx: Knex.Transaction | Knex = knexDb.world) {
    return Alliance
      .query(trx)
      .findOne(where)
      .modify('fullAlliance');
  }

}
