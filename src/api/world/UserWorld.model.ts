import { Sequelize, Model, DataTypes, BelongsTo } from 'sequelize';
import { main } from '../../sqldb';

export class UserWorld extends Model {
  public static associations: {
    World: BelongsTo;
    Town: BelongsTo;
  };

  public id: number;
  public PlayerId: number;

  // Associations
  public UserId: number;
  public User: User;
  public WorldId: number;
  public World: World;
}

UserWorld.init({
  id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  PlayerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
  },
}, { sequelize: main.sequelize });

import { User } from './User.model';
import { World } from './World.model';

export const UserWorldUser = User.belongsToMany(World, { through: UserWorld });
export const UserWorldWorld = World.belongsToMany(User, { through: UserWorld });
