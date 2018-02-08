import {
  Sequelize,
  Model,
  DataTypes,
  BelongsTo,
  HasOne,
} from 'sequelize';
import { world } from '../../sqldb';

export type diplomacyType = 'alliance' | 'war';
export type diplomacyStatus = 'pending' | 'ongoing';

export class AllianceDiplomacy extends Model {
  static associations: {
    OriginAlliance: BelongsTo;
    OriginPlayer: HasOne;
    TargetAlliance: BelongsTo;
    TargetPlayer: HasOne;
  };

  public id: number;
  public type: diplomacyType;
  public status: diplomacyStatus;
  public data?: any;
  public createdAt: Date;

  // Associations
  public OriginAllianceId: number;
  public OriginAlliance: Alliance;
  public OriginPlayerId: number;
  public OriginPlayer: Player;
  public TargetAllianceId: number;
  public TargetAlliance: Alliance;
  public TargetPlayerId: number;
  public TargetPlayer: Player;
}
AllianceDiplomacy.init({
  id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  data: {
    type: DataTypes.JSON,
  },
}, { sequelize: world.sequelize });

import { Alliance } from 'api/alliance/alliance.model';
import { Player } from 'api/world/player.model';
