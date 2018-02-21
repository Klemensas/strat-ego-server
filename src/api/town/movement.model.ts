import { Sequelize, Model, DataTypes, BelongsTo } from 'sequelize';
import { Resources, Requirements, Combat } from '../util.model';
import { world } from '../../sqldb';

export type MovementType = 'attack' | 'support' | 'return';

export class Movement extends Model {
  public static associations: {
    MovementDestinationTown: BelongsTo;
    MovementOriginTown: BelongsTo;
  };

  public id: number;
  public units: { [name: string]: number };
  public haul: Resources;
  public type: MovementType;
  public endsAt: Date;
  public createdAt: Date;
  public updatedAt: Date;

  // Associations
  public MovementOriginId: number;
  public MovementOriginTown: Town;
  public MovementDestinationId: number;
  public MovementDestinationTown: Town;
}

Movement.init({
  id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  units: {
    type: DataTypes.JSON,
    allowNull: false,
  },
  haul: {
    type: DataTypes.JSON,
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  endsAt: {
    type: DataTypes.DATE,
  },
}, { sequelize: world.sequelize });

import { Town } from '../town/town.model';
