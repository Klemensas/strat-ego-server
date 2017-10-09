import { Sequelize, Model, DataTypes, HasMany } from 'sequelize';
import { Resources, Requirements, Combat } from '../util.model';
import { world } from '../../sqldb';

export class Player extends Model {
  public static associations: {
    Towns: HasMany;
    ReportDestinationPlayer: HasMany,
    ReportOriginPlayer: HasMany,
  };

  public _id: number;
  public UserId: number;
  public name: string;

  // Associations
  public Towns: Town[];
  public ReportDestinationPlayer: Report[];
  public ReportOriginPlayer: Report[];
}
Player.init({
  _id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  UserId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, { sequelize: world.sequelize });

import { Town } from '../town/Town.model';
import { Report } from '../report/Report.model';

export const PlayerOriginReports = Player.hasMany(Report, { as: 'ReportOriginPlayer', foreignKey: 'ReportOriginPlayerId' });
export const PlayerDestinationReports = Player.hasMany(Report, { as: 'ReportDestinationPlayer', foreignKey: 'ReportDestinationPlayerId' });
export const ReportDestinationPlayer = Report.belongsTo(Player, { as: 'ReportDestinationPlayer', foreignKey: 'ReportDestinationPlayerId' });
export const ReportOriginPlayer = Report.belongsTo(Player, { as: 'ReportOriginPlayer', foreignKey: 'ReportOriginPlayerId' });
