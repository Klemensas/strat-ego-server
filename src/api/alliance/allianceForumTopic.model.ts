import {
  Sequelize,
  Model,
  DataTypes,
  HasMany,
  BelongsTo,
} from 'sequelize';
import { world } from '../../sqldb';

export class AllianceForumTopic extends Model {
  static associations: {
    Category: BelongsTo;
    Poster: BelongsTo;
    Posts: HasMany;
  };

  public id: number;
  public name: string;

  // Associations
  public CategoryId: number;
  public Category: AllianceForumCategory;
  public PosterId: number;
  public Poster: Player;
  public Posts: AllianceForumPost[];
}
AllianceForumTopic.init({
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
}, { sequelize: world.sequelize });

import { Alliance } from 'api/alliance/alliance.model';
import { Player } from 'api/world/Player.model';
import { AllianceForumCategory } from 'api/alliance/allianceForumCategory.model';
import { AllianceForumPost } from 'api/alliance/allianceForumPost.model';
