import { world } from '../../../sqldb';
import { Transaction } from 'sequelize';
import { TownInstance } from '../town.model';

export default function generateReport(
  transaction: Transaction,
  outcome: string,
  origin: any, // TownInstance,
  destination: any, // TownInstance,
  haul = null,
) {
  return world.Report.create({
  haul,
  outcome,
  origin: {
    units: origin.units,
    losses: origin.losses,
  },
  destination: {
    units: destination.units,
    losses: destination.losses,
  },
  ReportOriginPlayerId: origin.playerId,
  ReportDestinationPlayerId: destination.playerId,
  ReportOriginTownId: origin.townId,
  ReportDestinationTownId: destination.townId,
}, { transaction })
}
