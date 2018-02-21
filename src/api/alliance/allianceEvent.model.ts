import {
  Sequelize,
  Model,
  DataTypes,
  BelongsTo,
  HasOne,
} from 'sequelize';
import { world } from '../../sqldb';

// TODO: use specifc status based on type
export type eventType = 'diplomacy' | 'membership' | 'forum' | 'roles' | 'invitation' | 'management';
export type eventStatus =
  'proposeAlliance' | 'cancelAlliance' | 'rejectAlliance' | 'startAlliance' | 'endAlliance' | 'proposeNap' | 'cancelNap' | 'rejectNap' | 'startNap' | 'endNap' | 'startWar' | 'endWar' |
  'join' | 'leave' | 'remove' |
  'update' |
  'update' | 'updateMember' |
  'create' | 'reject' | 'cancel' |
  'updateProfile' | 'create'
;

export class AllianceEvent extends Model {
  static associations: {
    OriginPlayer: BelongsTo;
    TargetPlayer: BelongsTo;
    OriginAlliance: BelongsTo;
    TargetAlliance: BelongsTo;
  };

  public id: number;
  public type: eventType;
  public status: eventStatus;
  public createdAt: Date;

  // Associations
  public OriginPlayerId: number;
  public OriginPlayer: Player;
  public TargetPlayerId: number;
  public TargetPlayer: Player;
  public OriginAllianceId: number;
  public OriginAlliance: Alliance;
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
