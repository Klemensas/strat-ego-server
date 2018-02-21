import { Sequelize, Model, DataTypes, BelongsTo } from 'sequelize';
import { Resources, Requirements, Combat } from '../util.model';
import { world } from '../../sqldb';

export class UnitQueue extends Model {
  public static associations: {
    Town: BelongsTo;
  };

  public id: number;
  public unit: string;
  public amount: number;
  public recruitTime: number;
  public endsAt: Date;

  // Associations
  public TownId: number;
  public Town: Town;
}

UnitQueue.init({
  id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  unit: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  amount: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  recruitTime: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  endsAt: {
    type: DataTypes.DATE,
  },
}, { sequelize: world.sequelize });

import { Town } from '../town/town.model';
