import {
  Sequelize,
  Model,
  DataTypes,
  HasMany,
  BelongsToManyAddAssociationsMixin,
  BelongsToManyRemoveAssociationMixin,
} from 'sequelize';
import { world } from '../../sqldb';

export interface AllianceRoles {
  [role: string]: string[];
}

export class Alliance extends Model {
  static associations: {
    Members: HasMany;
    Invitations: HasMany;
  };

  public id: number;
  public name: string;
  public roles: AllianceRoles;

  // Associations
  public Members: Player[];
  public Invitations: Player[];

  public addInvitation: BelongsToManyAddAssociationsMixin<Player, number>;
  public removeInvitation: BelongsToManyRemoveAssociationMixin<Player, number>;
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
    unique: true,
  },
  roles: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {
      Member: [],
      Owner: [],
    },
  },
}, { sequelize: world.sequelize });

import { Player } from './player.model';
