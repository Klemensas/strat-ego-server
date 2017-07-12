import { Transaction } from 'sequelize';
import WorldData from '../../../components/world';
import { world } from '../../../sqldb';
import { TownUnits, Resources } from '../town.model';
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
  public static resolveAttack(movement, targetTown) {
    const unitArrays = {
      attack: Object.entries(movement.units),
      defense: Object.entries(targetTown.units),
    };

    const attackStrength = unitArrays.attack.reduce(MovementResolver.reduceAttackStrength, { ...defaultStrength });
    attackStrength.total = attackStrength.general + attackStrength.cavalry + attackStrength.archer;

    const defenseStrength = unitArrays.defense.reduce(MovementResolver.reduceDefenseStrength, { ...defaultStrength });
    defenseStrength.total = defenseStrength.general + defenseStrength.cavalry + defenseStrength.archer;

    if (defenseStrength.total === 0) {
      return MovementResolver.handleAttackWin(unitArrays, 1, targetTown, movement);
    }

    const attackTypePercentages = {
      general: attackStrength.general / attackStrength.total,
      cavalry: attackStrength.cavalry / attackStrength.total,
      archer: attackStrength.archer / attackStrength.total,
    };

    const wallBonus = targetTown.getWallBonus();
    const [winner, losser] = combatTypes.reduce((sides, type) => {
      sides[0].strength += attackStrength[type] * attackTypePercentages[type];
      sides[1].strength += defenseStrength[type] * attackTypePercentages[type] * wallBonus;
      return sides;
    }, [{ side: 'attack', strength: 0 }, { side: 'defense', strength: 0 }]).sort((a, b) => b.strength - a.strength);

    const winnerLoss = MovementResolver.calculateLoss(winner.strength, losser.strength);

    const outcomeHandler = winner.side === 'attack' ?
      MovementResolver.handleAttackWin :
      MovementResolver.handleDefenseWin;
    return outcomeHandler(unitArrays, winnerLoss, targetTown, movement);
  }

  public static resolveReturn(movement, targetTown) {
    Object.entries(movement.units).forEach(([key, value]) => {
      const unit = targetTown.units[key];
      unit.outside -= value;
      unit.inside += value;
    });
    targetTown.changed('units', true);
    const maxRes = targetTown.getMaxRes();
    const clay = targetTown.resources.clay + movement.haul.clay;
    const wood = targetTown.resources.wood + movement.haul.wood;
    const iron = targetTown.resources.iron + movement.haul.iron;
    targetTown.resources = {
      clay: Math.min(maxRes, clay),
      wood: Math.min(maxRes, wood),
      iron: Math.min(maxRes, iron),
    };

    return world.sequelize.transaction((transaction) =>
      movement.destroy({ transaction })
      .then(() => targetTown.save({ transaction })),
    );

  }

  public static resolveSupport() {
    // Stub
  }

  private static handleAttackWin(unitArrays, winnerLoss: number, targetTown /*:TownInstance*/, movement) {
    const {
      maxHaul,
      survivors,
      attackingUnits,
      losses,
      actualLosses,
    } = unitArrays.attack.reduce((outcome, [key, val]) => {
      const survived = Math.round(val * winnerLoss);
      const loss = val - survived;
      outcome.attackingUnits[key] = val;
      outcome.actualLosses = outcome.actualLosses || !!loss;
      outcome.survivors[key] = survived;
      outcome.losses[key] = loss;
      outcome.maxHaul += outcome.survivors[key] * WorldData.unitMap[key].haul;
      return outcome;
    }, { survivors: {}, attackingUnits: {}, losses: {}, maxHaul: 0, actualLosses: false });

    const { resourcesLeft, haul } = MovementResolver.getHaul(targetTown.resources, maxHaul);
    targetTown.resources = resourcesLeft;

    const defenseUnits = {};
    targetTown.units = unitArrays.defense.reduce((units, [key, val]) => {
      defenseUnits[key] = val.inside;
      units[key] = val;
      units[key].inside = 0;
      return units;
    }, {});
    targetTown.changed('units', true);

    const movementTime = movement.endsAt - movement.createdAt;
    let originPlayerId;
    return world.sequelize.transaction((transaction: Transaction) => {
      return movement.destroy({ transaction })
        .then(() => targetTown.createMovementOriginTown({
          haul,
          units: survivors,
          type: 'return',
          endsAt: new Date(movement.endsAt).getTime() + movementTime,
          MovementDestinationId: movement.MovementOriginId,
        }, { transaction }))
        .then(() => targetTown.save({ transaction }))
        .then(() =>
          world.Town.findById(movement.MovementOriginId, { transaction })
            .then((originTown: any /* TownInstance */) => {
              originPlayerId = originTown.PlayerId;

              if (!actualLosses) {
                return null;
              }

              Object.entries(losses).forEach(([key, val]) => {
                originTown.units[key].outside -= val;
              });
              originTown.changed('units', true);
              return originTown.save({ transaction });
            }),
        )
        .then(() => generateReport(
          transaction,
          'attack',
          {
            townId: movement.MovementOriginId,
            playerId: originPlayerId,
            units: attackingUnits,
            losses,
          },
          {
            townId: movement.MovementDestinationId,
            playerId: targetTown.PlayerId,
            units: defenseUnits,
            losses: defenseUnits,
          }, {
            maxHaul,
            haul,
          },
        ));
    });
  }

  private static handleDefenseWin(unitArrays, winnerLoss, destinationTown, movement) {
    const { survivors, actualLosses, defenseUnits, losses } = unitArrays.defense.reduce((outcome, [key, val]) => {
      const survived = Math.round(val.inside * winnerLoss);
      const loss = val.inside - survived;
      outcome.defenseUnits[key] = val.inside;
      outcome.losses = loss;
      outcome.actualLosses = outcome.actualLosses || !!loss;
      outcome.survivors[key] = val;
      outcome.survivors[key].inside = survived;
      return outcome;
    }, { survivors: {}, actualLosses: false, defenseUnits: {}, losses: {} });

    const attackingUnits = {};
    let originPlayerId;

    return world.sequelize.transaction((transaction) =>
      movement.destroy({ transaction })
      .then(() => world.Town.findById(movement.MovementOriginId, { transaction }))
      .then((originTown) => {
        originPlayerId = originTown.PlayerId;
        unitArrays.attack.forEach(([key, val]) => {
          originTown.units[key].outside -= val;
          attackingUnits[key] = val;
        });
        originTown.changed('units', true);
        return originTown.save({ transaction });
      })
      .then(() => {
        if (!actualLosses) {
          return null;
        }
        destinationTown.units = survivors;
        destinationTown.changed('units', true);
        return destinationTown.save({ transaction });
      })
      .then(() => generateReport(
        transaction,
        'defense',
        {
          townId: movement.MovementOriginId,
          playerId: originPlayerId,
          units: attackingUnits,
          losses: attackingUnits,
        },
        {
          townId: movement.MovementDestinationId,
          playerId: destinationTown.PlayerId,
          units: defenseUnits,
          losses,
        },
      )),
    );
  }

  private static getHaul(townRes: Resources, maxHaul: number) {
    const totalRes = townRes.wood + townRes.clay + townRes.iron;
    const hauledAll = maxHaul > totalRes;
    return Object.entries(townRes).reduce((data, [key, val]) => {
      const resHaul = hauledAll ? val : maxHaul * (val / totalRes);
      data.resourcesLeft[key] = val - resHaul;
      data.haul[key] = resHaul;
      return data;
    }, { resourcesLeft: {}, haul: {} });
  }

  private static reduceAttackStrength(result: CombatStrength, [key, val]: [string, number]): CombatStrength {
    const unit = WorldData.unitMap[key];
    const unitAttack = unit.combat.attack * val;
    result[unit.attackType] += unitAttack;
    return result;
  }

  private static reduceDefenseStrength(result: CombatStrength, [key, val]: [string, TownUnits]): CombatStrength {
    const unit = WorldData.unitMap[key];
    result.general += unit.combat.defense.general * val.inside;
    result.cavalry += unit.combat.defense.cavalry * val.inside;
    result.archer += unit.combat.defense.archer * val.inside;
    return result;
  }

  private static calculateLoss(winner: number, loser: number): number {
    return 1 - (((loser / winner) ** 0.5) / (winner / loser));
  }
}

// function reduceAttackStrength(data, [key, val]) {
//   const unit = worldData.unitMap[key];
//   const unitAttack = unit.combat.attack * val;
//   data[unit.attackType] += unitAttack;
//   return data;
// }

// function reduceDefenseStrength(data, [key, val]) {
//   const unit = worldData.unitMap[key];
//   data.general += unit.combat.defense.general * val.inside;
//   data.cavalry += unit.combat.defense.cavalry * val.inside;
//   data.archer += unit.combat.defense.archer * val.inside;
//   return data;
// }

// function calculateWinnerLoss(winner, losser) {
//   return 1 - (((losser / winner) ** 0.5) / (winner / losser));
// }

// // const defaultStrength = { general: 0, cavalry: 0, archer: 0 };
// // const combatTypes = ['general', 'cavalry', 'archer'];

// function handleAttackWin(unitArrays, winnerLoss, destinationTown, movement) {
//   const { maxHaul, survivors, attackingUnits, losses, actualLosses } =
// unitArrays.attack.reduce((outcome, [key, val]) => {
//     const survived = Math.round(val * winnerLoss);
//     const loss = val - survived;
//     outcome.attackingUnits[key] = val;
//     outcome.actualLosses = outcome.actualLosses || !!loss;
//     outcome.survivors[key] = survived;
//     outcome.losses[key] = loss;
//     outcome.maxHaul += outcome.survivors[key] * worldData.unitMap[key].haul;
//     return outcome;
//   }, { survivors: {}, attackingUnits: {}, losses: {}, maxHaul: 0, actualLosses: false });

//   const totalRes = destinationTown.resources.wood + destinationTown.resources.clay + destinationTown.resources.iron;
//   const hauledAll = maxHaul > totalRes;
//   const { resourcesLeft, haul } = Object.entries(destinationTown.resources).reduce((data, [key, val]) => {
//     const resHaul = hauledAll ? val : maxHaul * (val / totalRes);
//     data.resourcesLeft[key] = val - resHaul;
//     data.haul[key] = resHaul;
//     return data;
//   }, { resourcesLeft: {}, haul: {} });
//   destinationTown.resources = resourcesLeft;

//   const defenseUnits = {};
//   destinationTown.units = unitArrays.defense.reduce((units, [key, val]) => {
//     defenseUnits[key] = val.inside;
//     units[key] = val;
//     units[key].inside = 0;
//     return units;
//   }, {});
//   destinationTown.changed('units', true);

//   const movementTime = movement.endsAt - movement.createdAt;
//   let originPlayerId;
//   return world.sequelize.transaction(transaction => {
//     return movement.destroy({ transaction })
//       .then(() => destinationTown.createMovementOriginTown({
//         haul,
//         units: survivors,
//         type: 'return',
//         endsAt: new Date(movement.endsAt).getTime() + movementTime,
//         MovementDestinationId: movement.MovementOriginId
//       }, { transaction }))
//       .then(() => destinationTown.save({ transaction }))
//       .then(() =>
//         world.Town.findById(movement.MovementOriginId, { transaction })
//           .then(originTown => {
//             originPlayerId = originTown.PlayerId;

//             if (!actualLosses) {
//               return null;
//             }

//             Object.entries(losses).forEach(([key, val]) => {
//               originTown.units[key].outside -= val;
//             });
//             originTown.changed('units', true);
//             return originTown.save({ transaction });
//           })
//       )
//       .then(() => generateReport(
//         transaction,
//         'attack',
//         {
//           townId: movement.MovementOriginId,
//           playerId: originPlayerId,
//           units: attackingUnits,
//           losses,
//         },
//         {
//           townId: movement.MovementDestinationId,
//           playerId: destinationTown.PlayerId,
//           units: defenseUnits,
//           losses: defenseUnits,
//         }, {
//           maxHaul,
//           haul,
//         }
//       ));
//   });
// }

// function handleDefenseWin(unitArrays, winnerLoss, destinationTown, movement) {
//   const { survivors, actualLosses, defenseUnits, losses } = unitArrays.defense.reduce((outcome, [key, val]) => {
//     const survived = Math.round(val.inside * winnerLoss);
//     const loss = val.inside - survived;
//     outcome.defenseUnits[key] = val.inside;
//     outcome.losses = loss;
//     outcome.actualLosses = outcome.actualLosses || !!loss;
//     outcome.survivors[key] = val;
//     outcome.survivors[key].inside = survived;
//     return outcome;
//   }, { survivors: {}, actualLosses: false, defenseUnits: {}, losses: {} });

//   const attackingUnits = {};
//   let originPlayerId;

//   return world.sequelize.transaction(transaction =>
//     movement.destroy({ transaction })
//     .then(() => world.Town.findById(movement.MovementOriginId, { transaction }))
//     .then(originTown => {
//       originPlayerId = originTown.PlayerId;
//       unitArrays.attack.forEach(([key, val]) => {
//         originTown.units[key].outside -= val;
//         attackingUnits[key] = val;
//       });
//       originTown.changed('units', true);
//       return originTown.save({ transaction });
//     })
//     .then(() => {
//       if (!actualLosses) {
//         return null;
//       }
//       destinationTown.units = survivors;
//       destinationTown.changed('units', true);
//       return destinationTown.save({ transaction });
//     })
//     .then(() => generateReport(
//       transaction,
//       'defense',
//       {
//         townId: movement.MovementOriginId,
//         playerId: originPlayerId,
//         units: attackingUnits,
//         losses: attackingUnits,
//       },
//       {
//         townId: movement.MovementDestinationId,
//         playerId: destinationTown.PlayerId,
//         units: defenseUnits,
//         losses,
//       },
//     ))
//   );
// }

// const resolveAttack = function attackResolver(movement, destinationTown) {
//   const unitArrays = {
//     attack: Object.entries(movement.units),
//     defense: Object.entries(destinationTown.units)
//   };

//   const attackStrength = unitArrays.attack.reduce(reduceAttackStrength, Object.assign({}, defaultStrength));
//   attackStrength.total = attackStrength.general + attackStrength.cavalry + attackStrength.archer;

//   const defenseStrength = unitArrays.defense.reduce(reduceDefenseStrength, Object.assign({}, defaultStrength));
//   defenseStrength.total = defenseStrength.general + defenseStrength.cavalry + defenseStrength.archer;

//   if (defenseStrength.total === 0) {
//     return handleAttackWin(unitArrays, 1, destinationTown, movement);
//   }

//   const attackTypePercentages = {
//     general: attackStrength.general / attackStrength.total,
//     cavalry: attackStrength.cavalry / attackStrength.total,
//     archer: attackStrength.archer / attackStrength.total
//   };

//   const wallBonus = destinationTown.getWallBonus();
//   const [winner, losser] = combatTypes.reduce((sides, type) => {
//     sides[0].strength += attackStrength[type] * attackTypePercentages[type];
//     sides[1].strength += defenseStrength[type] * attackTypePercentages[type] * wallBonus;
//     return sides;
//   }, [{ side: 'attack', strength: 0 }, { side: 'defense', strength: 0 }]).sort((a, b) => b.strength - a.strength);

//   const winnerLoss = calculateWinnerLoss(winner.strength, losser.strength);

//   const outcomeHandler = winner.side === 'attack' ? handleAttackWin : handleDefenseWin;
//   return outcomeHandler(unitArrays, winnerLoss, destinationTown, movement);
// };

// const resolveReturn = function returnResolver(movement, destinationTown) {
//   Object.entries(movement.units).forEach(([key, value]) => {
//     const unit = destinationTown.units[key];
//     unit.outside -= value;
//     unit.inside += value;
//     console.log('adding to town units', key, value);
//   });
//   console.log('town units', destinationTown.units)
//   destinationTown.changed('units', true);
//   const maxRes = destinationTown.getMaxRes();
//   const clay = destinationTown.resources.clay + movement.haul.clay;
//   const wood = destinationTown.resources.wood + movement.haul.wood;
//   const iron = destinationTown.resources.iron + movement.haul.iron;
//   destinationTown.resources = {
//     clay: Math.min(maxRes, clay),
//     wood: Math.min(maxRes, wood),
//     iron: Math.min(maxRes, iron),
//   };

//   return world.sequelize.transaction(transaction =>
//     movement.destroy({ transaction })
//     .then(() => destinationTown.save({ transaction }))
//   );
// };

// const resolveSupport = function supportResolver() {

// };

// export { resolveAttack, resolveReturn, resolveSupport };
