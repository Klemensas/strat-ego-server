"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var world_1 = require("../../../components/world");
var sqldb_1 = require("../../../sqldb");
var report_service_1 = require("./report.service");
function reduceAttackStrength(data, _a) {
    var key = _a[0], val = _a[1];
    var unit = world_1.default.unitMap[key];
    var unitAttack = unit.combat.attack * val;
    data[unit.attackType] += unitAttack;
    return data;
}
function reduceDefenseStrength(data, _a) {
    var key = _a[0], val = _a[1];
    var unit = world_1.default.unitMap[key];
    data.general += unit.combat.defense.general * val.inside;
    data.cavalry += unit.combat.defense.cavalry * val.inside;
    data.archer += unit.combat.defense.archer * val.inside;
    return data;
}
function calculateWinnerLoss(winner, losser) {
    return 1 - ((Math.pow((losser / winner), 0.5)) / (winner / losser));
}
var defaultStrength = { general: 0, cavalry: 0, archer: 0 };
var combatTypes = ['general', 'cavalry', 'archer'];
function handleAttackWin(unitArrays, winnerLoss, destinationTown, movement) {
    var _a = unitArrays.attack.reduce(function (outcome, _a) {
        var key = _a[0], val = _a[1];
        var survived = Math.round(val * winnerLoss);
        var loss = val - survived;
        outcome.attackingUnits[key] = val;
        outcome.actualLosses = outcome.actualLosses || !!loss;
        outcome.survivors[key] = survived;
        outcome.losses[key] = loss;
        outcome.maxHaul += outcome.survivors[key] * world_1.default.unitMap[key].haul;
        return outcome;
    }, { survivors: {}, attackingUnits: {}, losses: {}, maxHaul: 0, actualLosses: false }), maxHaul = _a.maxHaul, survivors = _a.survivors, attackingUnits = _a.attackingUnits, losses = _a.losses, actualLosses = _a.actualLosses;
    var totalRes = destinationTown.resources.wood + destinationTown.resources.clay + destinationTown.resources.iron;
    var hauledAll = maxHaul > totalRes;
    var _b = Object.entries(destinationTown.resources).reduce(function (data, _a) {
        var key = _a[0], val = _a[1];
        var resHaul = hauledAll ? val : maxHaul * (val / totalRes);
        data.resourcesLeft[key] = val - resHaul;
        data.haul[key] = resHaul;
        return data;
    }, { resourcesLeft: {}, haul: {} }), resourcesLeft = _b.resourcesLeft, haul = _b.haul;
    destinationTown.resources = resourcesLeft;
    var defenseUnits = {};
    destinationTown.units = unitArrays.defense.reduce(function (units, _a) {
        var key = _a[0], val = _a[1];
        defenseUnits[key] = val.inside;
        units[key] = val;
        units[key].inside = 0;
        return units;
    }, {});
    destinationTown.changed('units', true);
    var movementTime = movement.endsAt - movement.createdAt;
    var originPlayerId;
    return sqldb_1.world.sequelize.transaction(function (transaction) {
        return movement.destroy({ transaction: transaction })
            .then(function () { return destinationTown.createMovementOriginTown({
            haul: haul,
            units: survivors,
            type: 'return',
            endsAt: new Date(movement.endsAt).getTime() + movementTime,
            MovementDestinationId: movement.MovementOriginId,
        }, { transaction: transaction }); })
            .then(function () { return destinationTown.save({ transaction: transaction }); })
            .then(function () {
            return sqldb_1.world.Town.findById(movement.MovementOriginId, { transaction: transaction })
                .then(function (originTown) {
                originPlayerId = originTown.PlayerId;
                if (!actualLosses) {
                    return null;
                }
                Object.entries(losses).forEach(function (_a) {
                    var key = _a[0], val = _a[1];
                    originTown.units[key].outside -= val;
                });
                originTown.changed('units', true);
                return originTown.save({ transaction: transaction });
            });
        })
            .then(function () { return report_service_1.default(transaction, 'attack', {
            townId: movement.MovementOriginId,
            playerId: originPlayerId,
            units: attackingUnits,
            losses: losses,
        }, {
            townId: movement.MovementDestinationId,
            playerId: destinationTown.PlayerId,
            units: defenseUnits,
            losses: defenseUnits,
        }, {
            maxHaul: maxHaul,
            haul: haul,
        }); });
    });
}
function handleDefenseWin(unitArrays, winnerLoss, destinationTown, movement) {
    var _a = unitArrays.defense.reduce(function (outcome, _a) {
        var key = _a[0], val = _a[1];
        var survived = Math.round(val.inside * winnerLoss);
        var loss = val.inside - survived;
        outcome.defenseUnits[key] = val.inside;
        outcome.losses = loss;
        outcome.actualLosses = outcome.actualLosses || !!loss;
        outcome.survivors[key] = val;
        outcome.survivors[key].inside = survived;
        return outcome;
    }, { survivors: {}, actualLosses: false, defenseUnits: {}, losses: {} }), survivors = _a.survivors, actualLosses = _a.actualLosses, defenseUnits = _a.defenseUnits, losses = _a.losses;
    var attackingUnits = {};
    var originPlayerId;
    return sqldb_1.world.sequelize.transaction(function (transaction) {
        return movement.destroy({ transaction: transaction })
            .then(function () { return sqldb_1.world.Town.findById(movement.MovementOriginId, { transaction: transaction }); })
            .then(function (originTown) {
            originPlayerId = originTown.PlayerId;
            unitArrays.attack.forEach(function (_a) {
                var key = _a[0], val = _a[1];
                originTown.units[key].outside -= val;
                attackingUnits[key] = val;
            });
            originTown.changed('units', true);
            return originTown.save({ transaction: transaction });
        })
            .then(function () {
            if (!actualLosses) {
                return null;
            }
            destinationTown.units = survivors;
            destinationTown.changed('units', true);
            return destinationTown.save({ transaction: transaction });
        })
            .then(function () { return report_service_1.default(transaction, 'defense', {
            townId: movement.MovementOriginId,
            playerId: originPlayerId,
            units: attackingUnits,
            losses: attackingUnits,
        }, {
            townId: movement.MovementDestinationId,
            playerId: destinationTown.PlayerId,
            units: defenseUnits,
            losses: losses,
        }); });
    });
}
var resolveAttack = function attackResolver(movement, destinationTown) {
    var unitArrays = {
        attack: Object.entries(movement.units),
        defense: Object.entries(destinationTown.units),
    };
    var attackStrength = unitArrays.attack.reduce(reduceAttackStrength, Object.assign({}, defaultStrength));
    attackStrength.total = attackStrength.general + attackStrength.cavalry + attackStrength.archer;
    var defenseStrength = unitArrays.defense.reduce(reduceDefenseStrength, Object.assign({}, defaultStrength));
    defenseStrength.total = defenseStrength.general + defenseStrength.cavalry + defenseStrength.archer;
    if (defenseStrength.total === 0) {
        return handleAttackWin(unitArrays, 1, destinationTown, movement);
    }
    var attackTypePercentages = {
        general: attackStrength.general / attackStrength.total,
        cavalry: attackStrength.cavalry / attackStrength.total,
        archer: attackStrength.archer / attackStrength.total,
    };
    var wallBonus = destinationTown.getWallBonus();
    var _a = combatTypes.reduce(function (sides, type) {
        sides[0].strength += attackStrength[type] * attackTypePercentages[type];
        sides[1].strength += defenseStrength[type] * attackTypePercentages[type] * wallBonus;
        return sides;
    }, [{ side: 'attack', strength: 0 }, { side: 'defense', strength: 0 }]).sort(function (a, b) { return b.strength - a.strength; }), winner = _a[0], losser = _a[1];
    var winnerLoss = calculateWinnerLoss(winner.strength, losser.strength);
    var outcomeHandler = winner.side === 'attack' ? handleAttackWin : handleDefenseWin;
    return outcomeHandler(unitArrays, winnerLoss, destinationTown, movement);
};
exports.resolveAttack = resolveAttack;
var resolveReturn = function returnResolver(movement, destinationTown) {
    Object.entries(movement.units).forEach(function (_a) {
        var key = _a[0], value = _a[1];
        var unit = destinationTown.units[key];
        unit.outside -= value;
        unit.inside += value;
    });
    destinationTown.changed('units', true);
    var maxRes = destinationTown.getMaxRes();
    var clay = destinationTown.resources.clay + movement.haul.clay;
    var wood = destinationTown.resources.wood + movement.haul.wood;
    var iron = destinationTown.resources.iron + movement.haul.iron;
    destinationTown.resources = {
        clay: Math.min(maxRes, clay),
        wood: Math.min(maxRes, wood),
        iron: Math.min(maxRes, iron),
    };
    return sqldb_1.world.sequelize.transaction(function (transaction) {
        return movement.destroy({ transaction: transaction })
            .then(function () { return destinationTown.save({ transaction: transaction }); });
    });
};
exports.resolveReturn = resolveReturn;
var resolveSupport = function supportResolver() { };
exports.resolveSupport = resolveSupport;
//# sourceMappingURL=movement.resolver.js.map