import * as Bluebird from 'bluebird';
import { Transaction } from 'sequelize';
import WorldData from '../../../components/world';
import { world } from '../../../sqldb';
import { Town, TownUnits, Resources } from '../town.model';
import { Report } from '../../report/report.model';
import { Movement } from '../movement.model';
import generateReport from './report.service';

interface CombatStrength {
  general: number;
  cavalry: number;
  archer: number;
  total?: number;
}

const defaultStrength: CombatStrength = { general: 0, cavalry: 0, archer: 0 };
const combatTypes = ['general', 'cavalry', 'archer'];

export default class MovementResolver {
  static resolveMovement(movement: Movement, initTown: Town) {

    switch (movement.type) {
      case 'attack':
        return MovementResolver.fetchTownAndResolveAttack(movement, initTown);
      case 'return':
        return MovementResolver.resolveReturn(movement, initTown);
      case 'support':
        return MovementResolver.resolveSupport();
    }
  }

  static fetchTownAndResolveAttack(movement: Movement, town: Town) {
    const isOrigin = movement.MovementOriginId === town.id;
    const missingTown = isOrigin ? movement.MovementDestinationId : movement.MovementOriginId;

    return world.sequelize['models'].Town.processTownQueues(missingTown, movement.endsAt)
      .then((processedTown) => {
        const otherTown = processedTown.town;
        if (isOrigin) {
          return MovementResolver.resolveAttack(movement, otherTown, town);
        }
        return MovementResolver.resolveAttack(movement, town, otherTown);
      })
      .then(({ report, originTown, destinationTown }) => isOrigin ? originTown : destinationTown);
  }

  static resolveAttack(movement: Movement, destinationTown: Town, originTown: Town) {
    const unitArrays = {
      attack: Object.entries(movement.units),
      defense: Object.entries(destinationTown.units),
    };

    const attackStrength = MovementResolver.calculateAttackStrength(unitArrays.attack);

    const defenseStrength = MovementResolver.calculateDefenseStrength(unitArrays.defense);
    attackStrength.total = attackStrength.general + attackStrength.cavalry + attackStrength.archer;
    defenseStrength.total = defenseStrength.general + defenseStrength.cavalry + defenseStrength.archer;

    if (defenseStrength.total === 0) {
      return MovementResolver.handleAttackWin(unitArrays, 1, movement, destinationTown, originTown);
    }

    const attackTypePercentages = {
      general: attackStrength.general / attackStrength.total,
      cavalry: attackStrength.cavalry / attackStrength.total,
      archer: attackStrength.archer / attackStrength.total,
    };

    const wallBonus = destinationTown.getWallBonus();
    const [winner, losser] = combatTypes.reduce((sides, type) => {
      sides[0].strength += attackStrength[type] * attackTypePercentages[type];
      sides[1].strength += defenseStrength[type] * attackTypePercentages[type] * wallBonus;
      return sides;
    }, [{ side: 'attack', strength: 0 }, { side: 'defense', strength: 0 }]).sort((a, b) => b.strength - a.strength);

    const winnerLoss = MovementResolver.calculateLoss(winner.strength, losser.strength);

    const outcomeHandler = winner.side === 'attack' ?
      MovementResolver.handleAttackWin :
      MovementResolver.handleDefenseWin;
    return outcomeHandler(unitArrays, winnerLoss, movement, destinationTown, originTown);
  }

  static resolveReturn(movement: Movement, destinationTown: Town) {
    Object.entries(movement.units).forEach(([key, value]) => {
      const unit = destinationTown.units[key];
      unit.outside -= value;
      unit.inside += value;
    });
    destinationTown.changed('units', true);
    const maxRes = destinationTown.getMaxRes();
    const clay = destinationTown.resources.clay + movement.haul.clay;
    const wood = destinationTown.resources.wood + movement.haul.wood;
    const iron = destinationTown.resources.iron + movement.haul.iron;
    destinationTown.resources = {
      clay: Math.min(maxRes, clay),
      wood: Math.min(maxRes, wood),
      iron: Math.min(maxRes, iron),
    };

    return world.sequelize.transaction((transaction) =>
      movement.destroy({ transaction })
      .then(() => destinationTown.save({ transaction })),
    );

  }

  static resolveSupport() {
    // Stub
  }

  static handleAttackWin(
    unitArrays,
    winnerLoss: number,
    movement: Movement,
    destinationTown: Town,
    originTown: Town,
  ): Bluebird<{ report: Report, originTown: Town, destinationTown: Town}> {
    let {
      maxHaul,
      survivors,
      attackingUnits,
      losses,
      unitChange,
    } = unitArrays.attack.reduce((outcome, [key, val]) => {
      const survived = Math.round(val * winnerLoss);
      const loss = val - survived;
      outcome.attackingUnits[key] = val;
      outcome.unitChange = outcome.unitChange || !!loss;
      outcome.survivors[key] = survived;
      outcome.losses[key] = loss;
      outcome.maxHaul += outcome.survivors[key] * WorldData.unitMap[key].haul;
      return outcome;
    }, { survivors: {}, attackingUnits: {}, losses: {}, maxHaul: 0, unitChange: false });

    destinationTown
      .updateRes(movement.endsAt)
      .getLoyaltyGrowth(movement.endsAt);
    const { resourcesLeft, haul } = MovementResolver.getHaul(destinationTown.resources, maxHaul);
    destinationTown.resources = resourcesLeft;
    const loyaltyChange = MovementResolver.getLoyaltyChange(survivors.noble);

    const defenseUnits = {};
    destinationTown.units = unitArrays.defense.reduce((units, [key, val]) => {
      defenseUnits[key] = val.inside;
      units[key] = val;
      units[key].inside = 0;
      return units;
    }, {});
    destinationTown.changed('units', true);
    const townLoyalty = destinationTown.loyalty;
    const changedLoyalty = destinationTown.loyalty - loyaltyChange;
    const destinationPlayerId = destinationTown.PlayerId;
    destinationTown.loyalty = changedLoyalty;
    if (changedLoyalty <= 0) {
      destinationTown.loyalty = WorldData.world.initialLoyalty;
      destinationTown.PlayerId = originTown.PlayerId;
      destinationTown.units = Town.setInitialUnits();
      originTown.units.noble.outside -= 1;
      unitChange = true;
      survivors.noble--;
    }

    const movementTime = movement.endsAt.getTime() - movement.createdAt.getTime();
    return world.sequelize.transaction((transaction: Transaction) => {
      return movement.destroy({ transaction })
        .then(() => destinationTown.createMovementOriginTown({
          haul,
          units: survivors,
          type: 'return',
          endsAt: movement.endsAt.getTime() + movementTime,
          MovementDestinationId: movement.MovementOriginId,
        }, { transaction }))
        .then(() => destinationTown.save({ transaction }))
        .then((updatedDestinationTown) => {
          destinationTown = updatedDestinationTown;
          if (!unitChange) {
            return originTown;
          }

          Object.entries(losses).forEach(([key, val]) => {
            originTown.units[key].outside -= val;
          });
          originTown.changed('units', true);
          return originTown.save({ transaction });
        })
        .then((updatedOriginTown: Town) => originTown = updatedOriginTown)
        .then(() => generateReport(
          transaction,
          'attack',
          {
            townId: movement.MovementOriginId,
            playerId: originTown.PlayerId,
            units: attackingUnits,
            losses,
          },
          {
            townId: movement.MovementDestinationId,
            playerId: destinationPlayerId,
            units: defenseUnits,
            losses: defenseUnits,
          }, {
            maxHaul,
            haul,
          },
          [townLoyalty, changedLoyalty],
        ))
        .then((report: Report) => ({ report, originTown, destinationTown }));
    });
  }

  static handleDefenseWin(
    unitArrays,
    winnerLoss: number,
    movement: Movement,
    destinationTown: Town,
    originTown: Town,
  ): Bluebird<{ report: Report, originTown: Town, destinationTown: Town}> {
    const { survivors, unitChange, defenseUnits, losses } = unitArrays.defense.reduce((outcome, [key, val]) => {
      const survived = Math.round(val.inside * winnerLoss);
      const loss = val.inside - survived;
      outcome.defenseUnits[key] = val.inside;
      outcome.losses = loss;
      outcome.unitChange = outcome.unitChange || !!loss;
      outcome.survivors[key] = val;
      outcome.survivors[key].inside = survived;
      return outcome;
    }, { survivors: {}, unitChange: false, defenseUnits: {}, losses: {} });

    const attackingUnits = {};

    return world.sequelize.transaction((transaction) => {
      return movement.destroy({ transaction })
      .then(() => {
        unitArrays.attack.forEach(([key, val]) => {
          originTown.units[key].outside -= val;
          attackingUnits[key] = val;
        });
        originTown.changed('units', true);
        return originTown.save({ transaction });
      })
      .then((updatedOriginTown: Town) => {
        originTown = updatedOriginTown;
        if (!unitChange) {
          return destinationTown;
        }
        destinationTown.units = survivors;
        destinationTown.changed('units', true);
        return destinationTown.save({ transaction });
      })
      .then((updatedDestinationTown: Town) => destinationTown = updatedDestinationTown)
      .then(() => generateReport(
        transaction,
        'defense',
        {
          townId: movement.MovementOriginId,
          playerId: originTown.PlayerId,
          units: attackingUnits,
          losses: attackingUnits,
        },
        {
          townId: movement.MovementDestinationId,
          playerId: destinationTown.PlayerId,
          units: defenseUnits,
          losses,
        },
      ))
      .then((report: Report) => ({ report, originTown, destinationTown }));
    });
  }

  static getHaul(townRes: Resources, maxHaul: number) {
    const totalRes = townRes.wood + townRes.clay + townRes.iron;
    const hauledAll = maxHaul > totalRes;
    return Object.entries(townRes).reduce((data, [key, val]) => {
      const resHaul = hauledAll ? val : maxHaul * (val / totalRes);
      data.resourcesLeft[key] = val - resHaul;
      data.haul[key] = resHaul;
      return data;
    }, { resourcesLeft: {}, haul: {} });
  }

  static calculateAttackStrength(units): CombatStrength {
    return units.reduce((result, [key, val]) => {
      const unit = WorldData.unitMap[key];
      const unitAttack = unit.combat.attack * val;
      result[unit.attackType] += unitAttack;

      return result;
    }, { ...defaultStrength });
  }

  static calculateDefenseStrength(units): CombatStrength {
    return units.reduce((result, [key, val]) => {
      const unit = WorldData.unitMap[key];
      result.general += unit.combat.defense.general * val.inside;
      result.cavalry += unit.combat.defense.cavalry * val.inside;
      result.archer += unit.combat.defense.archer * val.inside;

      return result;
    }, { ...defaultStrength });
  }

  static calculateLoss(winner: number, loser: number): number {
    return 1 - (((loser / winner) ** 0.5) / (winner / loser));
  }

  static getLoyaltyChange(units) {
    let change = 0;
    const changeRange = WorldData.world.loyaltyReductionRange[1] - WorldData.world.loyaltyReductionRange[0];
    for (let i = 0; i < units; i++) {
      change += WorldData.world.loyaltyReductionRange[0] + Math.round(Math.random() * changeRange);
    }
    return change;
  }
}
