import { Sequelize, Model, DataTypes, BelongsTo } from 'sequelize';
import { Resources, Requirements, Combat } from '../util.model';
import { world } from '../../sqldb';

export class BuildingQueue extends Model {
  public static associations: {
    Town: BelongsTo;
  };

  public _id: number;
  public building: string;
  public level: number;
  public buildTime: number;
  public endsAt: Date;

  // Associations
  public TownId: number;
  public Town: Town;
}

BuildingQueue.init({
  _id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  building: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  level: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  buildTime: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  endsAt: {
    type: DataTypes.DATE,
  },
}, { sequelize: world.sequelize });

import { Town } from '../town/Town.model';
