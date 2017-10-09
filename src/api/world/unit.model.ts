import { Sequelize, Model, DataTypes } from 'sequelize';
import { Resources, Requirements, Combat } from '../util.model';
import { world } from '../../sqldb';

export class Unit extends Model {
  public _id: number;
  public name: string;
  public attackType: string;
  public speed: number;
  public recruitTime: number;
  public haul: number;
  public requirements: Requirements[];
  public costs: Resources;
  public combat: Combat;
}

Unit.init({
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
  attackType: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  speed: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  recruitTime: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  haul: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  requirements: {
    type: DataTypes.ARRAY(DataTypes.JSON),
  },
  costs: {
    type: DataTypes.JSON,
    allowNull: false,
  },
  combat: {
    type: DataTypes.JSON,
    allowNull: false,
  },
}, { sequelize: world.sequelize });
