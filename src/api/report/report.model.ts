import { Sequelize, Model, DataTypes, BelongsTo } from 'sequelize';
import { Resources, Requirements, Combat } from '../util.model';
import { world } from '../../sqldb';
import { io } from '../../';

export interface Haul {
  maxHaul: number;
  haul: Resources;
}

export interface CombatCasualties {
  units: { [name: string]: number };
  losses: { [name: string]: number };
}

export class Report extends Model {
  public static associations: {
    ReportDestinationTown: BelongsTo;
    ReportOriginTown: BelongsTo;
    ReportDestinationPlayer: BelongsTo;
    ReportOriginPlayer: BelongsTo;
  };

  public _id: number;
  public outcome: string;
  public origin: CombatCasualties;
  public destination: CombatCasualties;
  public haul: Haul;
  public loyaltyChange: number[];

  // Associations
  public ReportOriginTownId: number;
  public ReportOriginTown: Town;
  public ReportDestinationTownId: number;
  public ReportDestinationTown: Town;
  public ReportOriginPlayerId: number;
  public ReportOriginPlayer: Player;
  public ReportDestinationPlayerId: number;
  public ReportDestinationPlayer: Player;
}

Report.init({
  _id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  outcome: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  origin: {
    type: DataTypes.JSONB,
    allowNull: false,
  },
  destination: {
    type: DataTypes.JSONB,
    allowNull: false,
  },
  haul: {
    type: DataTypes.JSON,
  },
  loyaltyChange: {
    type: DataTypes.ARRAY(DataTypes.INTEGER),
  },
}, { sequelize: world.sequelize });

Report.afterCreate((report: Report) => {
  // io.sockets.in(report.ReportOriginTownId as any).emit('report', report);
  // if (report.ReportDestinationPlayerId) {
  //   io.sockets.in(report.ReportDestinationTownId as any).emit('report', report);
  // }
});

import { Town } from '../town/Town.model';
import { Player } from '../world/Player.model';
