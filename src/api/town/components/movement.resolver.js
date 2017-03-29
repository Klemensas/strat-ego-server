import worldData from '../../../components/worlds';
import { world } from '../../../sqldb';

function reduceAttackStrength(data, [key, val]) {
  const unit = worldData.unitMap[key];
  const unitAttack = unit.combat.attack * val;
  data[unit.attackType] += unitAttack;
  return data;
}

function reduceDefenseStrength(data, [key, val]) {
  const unit = worldData.unitMap[key];
  data.general += unit.combat.defense.general * val.inside;
  data.cavalry += unit.combat.defense.cavalry * val.inside;
  data.archer += unit.combat.defense.archer * val.inside;
  return data;
}

function calculateWinnerLoss(winner, losser) {
  return 1 - (((losser / winner) ** 0.5) / (winner / losser));
}

const defaultStrength = { general: 0, cavalry: 0, archer: 0 };
const combatTypes = ['general', 'cavalry', 'archer'];

function handleAttackWin(unitArrays, winnerLoss, destinationTown, movement) {
  const { maxHaul, survivors, losses, actualLosses } = unitArrays.attack.reduce((outcome, [key, val]) => {
    const survived = Math.round(val * winnerLoss);
    const loss = val - survived;
    outcome.actualLosses = outcome.actualLosses || !!loss;
    outcome.survivors[key] = survived;
    outcome.losses[key] = loss;
    outcome.maxHaul += outcome.survivors[key] * worldData.unitMap[key].haul;
    return outcome;
  }, { survivors: {}, losses: {}, maxHaul: 0, actualLosses: false });

  const totalRes = destinationTown.resources.wood + destinationTown.resources.clay + destinationTown.resources.iron;
  const hauledAll = maxHaul > totalRes;
  const { resourcesLeft, haul } = Object.entries(destinationTown.resources).reduce((data, [key, val]) => {
    const resHaul = hauledAll ? val : maxHaul * (val / totalRes);
    data.resourcesLeft[key] = val - resHaul;
    data.haul[key] = resHaul;
    return data;
  }, { resourcesLeft: {}, haul: {} });
  destinationTown.resources = resourcesLeft;

  destinationTown.units = unitArrays.defense.reduce((units, [key, val]) => {
    units[key] = val;
    units[key].inside = 0;
    return units;
  }, {});

  const movementTime = movement.endsAt - movement.createdAt;
  return world.sequelize.transaction(transaction => {
    return movement.destroy({ transaction })
      .then(() => destinationTown.createMovementOriginTown({
        haul,
        units: survivors,
        type: 'return',
        endsAt: movement.endsAt + movementTime,
        MovementDestinationId: movement.MovementOriginId
      }, { transaction }))
      .then(() => destinationTown.save({ transaction }))
      .then(() => {
        if (!actualLosses) {
          return null;
        }
        return world.Town.findById(movement.MovementOriginId, { transaction })
          .then(originTown => {
            Object.entries(losses).forEach(([key, val]) => {
              originTown.units[key].outside -= val;
            });
            return originTown.save({ transaction });
          });
      });
  });
}

function handleDefenseWin(unitArrays, winnerLoss, destinationTown, movement) {
  const { survivors, actualLosses } = unitArrays.defense.reduce((outcome, [key, val]) => {
    const survived = Math.round(val.inside * winnerLoss);
    const loss = val.inside - survived;
    outcome.actualLosses = outcome.actualLosses || !!loss;
    outcome[key] = val;
    outcome[key].inside = survived;
    return outcome;
  }, { survivors: {}, actualLosses: false });

  return world.sequelize.transaction(transaction =>
    movement.destroy({ transaction })
    .then(() => world.Town.findById(movement.MovementOriginId, { transaction }))
    .then(originTown => {
      unitArrays.attack.forEach(([key, val]) => {
        originTown.units[key].outside -= val;
      });
      return originTown.save({ transaction });
    })
    .then(() => {
      if (!actualLosses) {
        return null;
      }
      destinationTown.units = survivors;
      return destinationTown.save({ transaction });
    })
  );
}

const resolveAttack = function attackResolver(movement, destinationTown) {
  const unitArrays = {
    attack: Object.entries(movement.units),
    defense: Object.entries(destinationTown.units)
  };

  const attackStrength = unitArrays.attack.reduce(reduceAttackStrength, defaultStrength);
  attackStrength.total = attackStrength.general + attackStrength.cavalry + attackStrength.archer;

  const defenseStrength = unitArrays.defense.reduce(reduceDefenseStrength, defaultStrength);
  defenseStrength.total = defenseStrength.general + defenseStrength.cavalry + defenseStrength.archer;

  if (defenseStrength.total === 0) {
    return handleAttackWin(unitArrays, 1, destinationTown, movement);
  }

  const attackTypePercentages = {
    general: attackStrength.general / attackStrength.total,
    cavalry: attackStrength.cavalry / attackStrength.total,
    archer: attackStrength.archer / attackStrength.total
  };

  const [winner, losser] = combatTypes.reduce((sides, type) => {
    sides[0].strength += attackStrength[type] * attackTypePercentages[type];
    sides[1].strength += defenseStrength[type] * attackTypePercentages[type];
    return sides;
  }, [{ side: 'attack', strength: 0 }, { side: 'defense', strength: 0 }]).sort((a, b) => b.strength - a.strength);

  const winnerLoss = calculateWinnerLoss(winner.strength, losser.strength);

  const outcomeHandler = winner.side === 'attack' ? handleAttackWin : handleDefenseWin;
  return outcomeHandler(unitArrays, winnerLoss, destinationTown, movement);
};

const resolveReturn = function returnResolver(movement, destinationTown) {
  Object.entries(movement.units).forEach(([key, value]) => {
    const unit = destinationTown.units[key];
    unit.outside -= value;
    unit.inside += value;
  });
  destinationTown.resources.wood += movement.haul.wood;
  destinationTown.resources.clay += movement.haul.clay;
  destinationTown.resources.iron += movement.haul.iron;

  return world.sequelize.transaction(transaction =>
    movement.destroy({ transaction })
    .then(() => destinationTown.save({ transaction }))
  );
};

const resolveSupport = function supportResolver() {

};

export { resolveAttack, resolveReturn, resolveSupport };
