import { Sequelize, Model, DataTypes, HasMany } from 'sequelize';
import { world } from '../../sqldb';

export interface AllianceRole {
  name: string;
  permissions: string[];
}

export class Alliance extends Model {
  public static associations: {
    Players: HasMany;
    InvitedPlayers: HasMany;
  };

  public id: number;
  public name: string;
  public memberCount: number;
  public roles: AllianceRole[];

  // Associations
  public Players: Player[];
  public InvitedPlayers: Player[];
}
Alliance.init({
  id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  memberCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  roles: {
    type: DataTypes.ARRAY(DataTypes.JSON),
    allowNull: false,
  },
}, { sequelize: world.sequelize });

import { Player } from './player.model';
