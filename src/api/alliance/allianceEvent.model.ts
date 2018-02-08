import {
  Sequelize,
  Model,
  DataTypes,
  BelongsTo,
  HasOne,
} from 'sequelize';
import { world } from '../../sqldb';

// TODO: use specifc status based on type
export type eventType = 'diplomacy' | 'membership' | 'forum' | 'roles' | 'permissions' | 'invitation';
export type eventStatus =
  'pending' | 'started' | 'ended' |
  'join' | 'leave' | 'remove' |
  'update' |
  'update' |
  'update' |
  'create' | 'reject' | 'cancel'
;

export class AllianceEvent extends Model {
  static associations: {
    InitiatingPlayer: BelongsTo;
    TargetPlayer: BelongsTo;
    InitiatingAlliance: BelongsTo;
    TargetAlliance: BelongsTo;
  };

  public id: number;
  public type: eventType;
  public status: eventStatus;
  public createdAt: Date;

  // Associations
  public InitiatingPlayerId: number;
  public InitiatingPlayer: Player;
  public TargetPlayerId: number;
  public TargetPlayer: Player;
  public InitiatingAllianceId: number;
  public InitiatingAlliance: Alliance;
  public TargetAllianceId: number;
  public TargetAlliance: Alliance;
}
AllianceEvent.init({
  id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  status: {
    type: DataTypes.STRING,
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, { sequelize: world.sequelize });

import { Alliance } from './alliance.model';
import { Player } from '../world/player.model';
