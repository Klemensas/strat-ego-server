import {
  Sequelize,
  Model,
  DataTypes,
  BelongsTo,
} from 'sequelize';
import { world } from '../../sqldb';

export class AllianceForumPost extends Model {
  static associations: {
    Topic: BelongsTo;
    Poster: BelongsTo;
  };

  public id: number;
  public body: string;

  // Associations
  public TopicId: number;
  public Topic: AllianceForumTopic;
  public PlayerId: number;
  public Poster: Player;
}
AllianceForumPost.init({
  id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  body: {
    type: DataTypes.TEXT ,
    allowNull: false,
  },
}, { sequelize: world.sequelize });

import { AllianceForumTopic } from 'api/alliance/allianceForumTopic.model';
import { Player } from 'api/world/Player.model';
