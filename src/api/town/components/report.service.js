import { world } from '../../../sqldb';

export default (transaction, outcome, origin, destination, haul) => world.Report.create({
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
