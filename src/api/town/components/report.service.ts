import { Report } from '../../report/Report.model';

export default (transaction, outcome, origin, destination, haul = null) => Report.create({
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
}, { transaction });
