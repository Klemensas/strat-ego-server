"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var sqldb_1 = require("../../../sqldb");
exports.default = function (transaction, outcome, origin, destination, haul) {
    if (haul === void 0) { haul = null; }
    return sqldb_1.world.Report.create({
        haul: haul,
        outcome: outcome,
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
    }, { transaction: transaction });
};
//# sourceMappingURL=report.service.js.map