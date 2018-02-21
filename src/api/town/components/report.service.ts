import { Report } from '../../report/report.model';

export default (transaction, outcome, origin, destination, haul = null, loyaltyChange = []) => Report.create({
  haul,
  outcome,
  loyaltyChange,
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
}, { transaction });
