import worldData from '../../../components/worlds';
import { world } from '../../../sqldb';
import generateReport from './report.service';

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
  const { maxHaul, survivors, attackingUnits, losses, actualLosses } = unitArrays.attack.reduce((outcome, [key, val]) => {
    const survived = Math.round(val * winnerLoss);
    const loss = val - survived;
    outcome.attackingUnits[key] = val;
    outcome.actualLosses = outcome.actualLosses || !!loss;
    outcome.survivors[key] = survived;
    outcome.losses[key] = loss;
    outcome.maxHaul += outcome.survivors[key] * worldData.unitMap[key].haul;
    return outcome;
  }, { survivors: {}, attackingUnits: {}, losses: {}, maxHaul: 0, actualLosses: false });

  const totalRes = destinationTown.resources.wood + destinationTown.resources.clay + destinationTown.resources.iron;
  const hauledAll = maxHaul > totalRes;
  const { resourcesLeft, haul } = Object.entries(destinationTown.resources).reduce((data, [key, val]) => {
    const resHaul = hauledAll ? val : maxHaul * (val / totalRes);
    data.resourcesLeft[key] = val - resHaul;
    data.haul[key] = resHaul;
    return data;
  }, { resourcesLeft: {}, haul: {} });
  destinationTown.resources = resourcesLeft;

  const defenseUnits = {};
  destinationTown.units = unitArrays.defense.reduce((units, [key, val]) => {
    defenseUnits[key] = val.inside;
    units[key] = val;
    units[key].inside = 0;
    return units;
  }, {});
  destinationTown.changed('units', true);

  const movementTime = movement.endsAt - movement.createdAt;
  let originPlayerId;
  return world.sequelize.transaction(transaction => {
    return movement.destroy({ transaction })
      .then(() => destinationTown.createMovementOriginTown({
        haul,
        units: survivors,
        type: 'return',
        endsAt: new Date(movement.endsAt).getTime() + movementTime,
        MovementDestinationId: movement.MovementOriginId
      }, { transaction }))
      .then(() => destinationTown.save({ transaction }))
      .then(() =>
        world.Town.findById(movement.MovementOriginId, { transaction })
          .then(originTown => {
            originPlayerId = originTown.PlayerId;

            if (!actualLosses) {
              return null;
            }

            Object.entries(losses).forEach(([key, val]) => {
              originTown.units[key].outside -= val;
            });
            originTown.changed('units', true);
            return originTown.save({ transaction });
          })
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
          playerId: destinationTown.PlayerId,
          units: defenseUnits,
          losses: defenseUnits,
        }, {
          maxHaul,
          haul,
        }
      ));
  });
}

function handleDefenseWin(unitArrays, winnerLoss, destinationTown, movement) {
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

  return world.sequelize.transaction(transaction =>
    movement.destroy({ transaction })
    .then(() => world.Town.findById(movement.MovementOriginId, { transaction }))
    .then(originTown => {
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
    ))
  );
}

const resolveAttack = function attackResolver(movement, destinationTown) {
  const unitArrays = {
    attack: Object.entries(movement.units),
    defense: Object.entries(destinationTown.units)
  };

  const attackStrength = unitArrays.attack.reduce(reduceAttackStrength, Object.assign({}, defaultStrength));
  attackStrength.total = attackStrength.general + attackStrength.cavalry + attackStrength.archer;

  const defenseStrength = unitArrays.defense.reduce(reduceDefenseStrength, Object.assign({}, defaultStrength));
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
    console.log('adding to town units', key, value);
  });
  console.log('town units', destinationTown.units)
  destinationTown.changed('units', true);
  //  destinationTown.changed('resource', true);
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
