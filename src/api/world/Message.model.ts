import { Sequelize, Model, DataTypes, BelongsTo } from 'sequelize';
import { world } from '../../sqldb';

export interface MessageContent {
  text: string;
}

export class Message extends Model {
  public static associations: {
    ReportDestinationTown: BelongsTo;
    ReportOriginTown: BelongsTo;
    ReportDestinationPlayer: BelongsTo;
    ReportOriginPlayer: BelongsTo;
  };

  public id: number;
  public : boolean;
  public topic: string;
  public message: MessageContent[];
  // public outcome: string;
  // public origin: CombatCasualties;
  // public destination: CombatCasualties;
  // public haul: Haul;
  // public loyaltyChange: number[];

  // // Associations
  // public ReportOriginTownId: number;
  // public ReportOriginTown: Town;
  // public ReportDestinationTownId: number;
  // public ReportDestinationTown: Town;
  // public ReportOriginPlayerId: number;
  // public ReportOriginPlayer: Player;
  // public ReportDestinationPlayerId: number;
  // public ReportDestinationPlayer: Player;
}

Report.init({
  id: {
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
