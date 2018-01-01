import {
  Sequelize,
  Model,
  DataTypes,
  BelongsTo,
  HasMany,
} from 'sequelize';
import { world } from '../../sqldb';

export class AllianceForumCategory extends Model {
  static associations: {
    Alliance: BelongsTo;
    Topics: HasMany;
  };

  public id: number;
  public name: string;
  public description: string;
  public whitelistRoles: string[];

  // Associations
  public AllianceId: number;
  public Alliance: Alliance;
  public Topics: AllianceForumTopic[];
}
AllianceForumCategory.init({
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
  description: {
    type: DataTypes.STRING,
  },
  whitelistRoles: {
    type: DataTypes.ARRAY(DataTypes.STRING),
  },
}, { sequelize: world.sequelize });

import { Alliance } from 'api/alliance/alliance.model';
import { AllianceForumTopic } from 'api/alliance/allianceForumTopic.model';
