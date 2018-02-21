import {
  Sequelize,
  Model,
  DataTypes,
  BelongsTo,
  HasMany,
} from 'sequelize';
import { world } from '../../sqldb';

export class AllianceMessage extends Model {
  static associations: {
    Alliance: BelongsTo;
    Player: BelongsTo;
  };

  public id: number;
  public text: string;
  public description: string;
  public createdAt: Date;

  // Associations
  public AllianceId: number;
  public Alliance: Alliance;
  public PlayerId: number;
  public Player: Player;
}
AllianceMessage.init({
  id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  text: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, { sequelize: world.sequelize });

import { Alliance } from 'api/alliance/alliance.model';
import { Player } from 'api/world/player.model';
