import { Sequelize, Model, DataTypes, HasMany } from 'sequelize';
import { main } from '../../sqldb';

export class World extends Model {
  public static associations: {
    Users: HasMany;
  };

  public name: string;
  public baseProduction: number;
  public speed: number;
  public size: number;
  public regionSize: number;
  public fillTime: number;
  public fillPercent: number;
  public barbPercent: number;
  public timeQouta: number;
  public generationArea: number;
  public currentRing: number;

  // Associations
  public Users: User[];
}

World.init({
  name: {
    allowNull: false,
    primaryKey: true,
    type: DataTypes.STRING,
  },
  baseProduction: {
    type: DataTypes.INTEGER,
  },
  speed: {
    type: DataTypes.INTEGER,
  },
  size: {
    type: DataTypes.INTEGER,
    // TODO: add matcher of odd number
  },
  regionSize: {
    type: DataTypes.INTEGER,
    // TODO: add verification that divisable by size
  },
  fillTime: {
    type: DataTypes.BIGINT,
  },
  fillPercent: {
    type: DataTypes.INTEGER,
  },
  barbPercent: {
    type: DataTypes.INTEGER,
  },
  timeQouta: {
    type: DataTypes.INTEGER,
  },
  generationArea: {
    type: DataTypes.INTEGER,
  },
  currentRing: {
    type: DataTypes.INTEGER,
  },
}, { sequelize: main.sequelize });

// importd { UserWorld } from './UserWorld.model';
import { User } from './User.model';
import { UserWorld } from './UserWorld.model';
// export const WorldUser = World.hasMany(UserWorld, { as: 'Users', foreignKey: 'WorldName' });

export const WorldUser = World.belongsToMany(User, { through: UserWorld });
