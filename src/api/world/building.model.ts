import { Sequelize, Model, DataTypes } from 'sequelize';
import { Resources, Requirements } from '../util.model';
import { world } from '../../sqldb';

export class Building extends Model {
  public _id: number;
  public name: string;
  public levels: {
    max: number;
    min: number;
  };
  public requirements?: Requirements[];
  public data: [{
    buildTime: number;
    costs: Resources;
    storage?: number;
    population?: number;
    recruitment?: number;
    production?: number;
    defense?: number;
  }];
}

Building.init({
  _id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  levels: {
    type: DataTypes.JSON,
    allowNull: false,
  },
  requirements: {
    type: DataTypes.ARRAY(DataTypes.JSON),
  },
  data: {
    type: DataTypes.JSON,
    allowNull: false,
  },
}, { sequelize: world.sequelize });
