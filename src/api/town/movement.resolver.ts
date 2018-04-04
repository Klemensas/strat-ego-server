import { MovementUnit, TownUnits, TownUnit, CombatStrength, Resources, MovementType, CombatOutcome, Haul, Dict } from 'strat-ego-common';

import { Town } from './town';
import { Movement } from './movement';
import { worldData } from '../world/worldData';
import { knexDb } from '../../sqldb';
import { transaction } from 'objection';
import { Report } from './report';

const defaultStrength: CombatStrength = { general: 0, cavalry: 0, archer: 0 };
const combatTypes = ['general', 'cavalry', 'archer'];

export interface OriginOutcome {
  town?: Partial<Town>;
  movement?: Partial<Movement>;
}

export interface TargetOutcome {
  playerId?: number;
  resources: Resources;
  loyalty: number;
  units?: TownUnits;
}

export interface AttackOutcome {
  origin: OriginOutcome;
  target: TargetOutcome;
  report: Partial<Report>;
}

export interface ResolvedAttack {
  originTown: Town;
  targetTown: Town;
  report: Report;
  movement?: Movement;
}

export type MovementUnitArray = [string, number];
export interface CombatantList {
  attack: MovementUnitArray[];
  defense: Array<[string, TownUnit]>;
}

export class MovementResolver {
  static movementTypeResolver = [MovementResolver.fetchTownAndResolveAttack, MovementResolver.resolveSupport, MovementResolver.resolveReturn];

  static resolveMovement(movement: Movement, initTown: Town): Promise<Town> {
    return MovementResolver.movementTypeResolver[movement.type](movement, initTown);
  }

  static async fetchTownAndResolveAttack(movement: Movement, town: Town) {
    const isOrigin = movement.originTownId === town.id;
    const missingTown = isOrigin ? movement.targetTownId : movement.originTownId;

    const processingResult = await Town.processTownQueues(missingTown, movement.endsAt);
    const otherTown: Town = processingResult.town;

    let result: ResolvedAttack;
    if (isOrigin) {
      result = await MovementResolver.resolveAttack(movement, otherTown, town);
      result.originTown.originMovements = result.originTown.originMovements.filter(({ id }) => id !== movement.id);
      if (result.movement) { result.originTown.targetMovements.push(result.movement); }
    } else {
      result = await MovementResolver.resolveAttack(movement, town, otherTown);
      result.targetTown.targetMovements = result.targetTown.targetMovements.filter(({ id }) => id !== movement.id);
    }
    return isOrigin ? result.originTown : result.targetTown;
  }

  static async resolveAttack(movement: Movement, targetTown: Town, originTown: Town) {
    const unitArrays: CombatantList = {
      attack: Object.entries(movement.units),
      defense: Object.entries(targetTown.units),
    };

    const attackStrength = MovementResolver.calculateAttackStrength(unitArrays.attack);

    const defenseStrength = MovementResolver.calculateDefenseStrength(unitArrays.defense);
    attackStrength.total = attackStrength.general + attackStrength.cavalry + attackStrength.archer;
    defenseStrength.total = defenseStrength.general + defenseStrength.cavalry + defenseStrength.archer;

    if (defenseStrength.total === 0) {
      return MovementResolver.handleAttackWin(unitArrays, 1, movement, targetTown, originTown);
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
    return outcomeHandler(unitArrays, winnerLoss, movement, targetTown, originTown);
  }

  static async resolveReturn(movement: Movement, targetTown: Town) {
    const units = Object.entries(movement.units).reduce((result, [key, value]) => {
      result[key].outside -= value;
      result[key].inside += value;
      return result;
    }, { ...targetTown.units });

    const resources = targetTown.getResources(movement.endsAt);
    const maxRes = targetTown.getMaxRes();
    resources.wood = Math.min(maxRes, resources.wood + movement.haul.wood);
    resources.clay = Math.min(maxRes, resources.clay + movement.haul.clay);
    resources.iron = Math.min(maxRes, resources.iron + movement.haul.iron);

    const trx = await transaction.start(knexDb.world);
    try {
      await movement.$query(trx).delete();
      await targetTown.$query(trx)
        .patch({
          units,
          resources,
          updatedAt: +movement.endsAt,
        })
        .context({
          resourcesUpdated: true,
        });
      await trx.commit();

      targetTown.targetMovements = targetTown.targetMovements.filter(({ id }) => id !== movement.id);
      return targetTown;
    } catch (err) {
      await trx.rollback();
      throw err;
    }
  }

  static async resolveSupport(movement: Movement, targetTown: Town) {
    // Stub
    return targetTown;
  }

  static handleAttackWin(unitArrays: CombatantList, winnerLoss: number, movement: Movement, targetTown: Town, originTown: Town) {
    const targetResources: Resources = targetTown.getResources(movement.endsAt);
    const targetLoyalty = targetTown.getLoyalty(movement.endsAt);

    const attackResult = unitArrays.attack.reduce((result, [key, val]) => {
      const survived = Math.round(val * winnerLoss);
      const loss = val - survived;
      result.attackingUnits[key] = val;
      result.unitChange = result.unitChange || !!loss;
      result.survivors[key] = survived;
      result.losses[key] = loss;
      result.maxHaul += result.survivors[key] * worldData.unitMap[key].haul;
      return result;
    }, {
      survivors: {},
      attackingUnits: {},
      losses: {},
      maxHaul: 0,
      unitChange: false,
    } as {
      survivors: Dict<number>;
      attackingUnits: Dict<number>;
      losses: Dict<number>;
      maxHaul: number;
      unitChange: boolean;
    });

    const { resources, haul } = MovementResolver.getHaul(targetTown.resources, attackResult.maxHaul);
    const originOutcome: OriginOutcome = {
      town: null,
      movement: {
        haul,
        units: attackResult.survivors,
      },
    };

    const loyaltyChange = MovementResolver.getLoyaltyChange(attackResult.survivors.noble);
    const loyalty = targetLoyalty - loyaltyChange;
    const isConquered = loyalty <= 0;

    const targetOutcome: TargetOutcome = {
      resources,
      loyalty,
    };
    const defenseResult = unitArrays.defense.reduce((result, [key, val]) => {
      result.combatUnits[key] = val.inside;
      result.units[key] = val;
      result.units[key].inside = 0;
      return result;
    }, { units: {}, combatUnits: {} });
    targetOutcome.units = defenseResult.units;

    if (isConquered) {
      const destinationPlayerId = targetTown.playerId;
      targetOutcome.playerId = originTown.playerId;
      targetOutcome.loyalty = worldData.world.initialLoyalty;
      targetOutcome.units = Town.setInitialUnits();
      attackResult.unitChange = true;
    }

    if (attackResult.unitChange) {
      const units = Object.entries(attackResult.losses).reduce((result, [key, val]) => {
        result[key].outside -= val;
        return result;
      }, { ...originTown.units });
      if (isConquered) {
        units.noble.outside -= 1;
        originOutcome.movement.units.noble -= 1;
      }

      originOutcome.town = {
        units,
      };
    }

    return MovementResolver.saveCombatOutcome(movement, targetTown, originTown, {
      origin: originOutcome,
      target: targetOutcome,
      report: {
        outcome: CombatOutcome.attack,
        origin: {
          units: attackResult.attackingUnits,
          losses: attackResult.losses,
        },
        target: {
          units: defenseResult.combatUnits,
          losses: defenseResult.combatUnits,
        },
        haul: {
          maxHaul: attackResult.maxHaul,
          haul,
        },
        loyaltyChange: [targetLoyalty, loyalty],
      },
    });
  }

  static handleDefenseWin(unitArrays: CombatantList, winnerLoss: number, movement: Movement, targetTown: Town, originTown: Town) {
    const defenseResult = unitArrays.defense.reduce((outcome, [key, val]) => {
      const survived = Math.round(val.inside * winnerLoss);
      const loss = val.inside - survived;
      outcome.defendingUnits[key] = val.inside;
      outcome.losses[key] = loss;
      outcome.hasLosses = outcome.hasLosses || !!loss;
      outcome.survivors[key] = val;
      outcome.survivors[key].inside = survived;
      return outcome;
    }, {
      survivors: {},
      defendingUnits: {},
      losses: {},
      hasLosses: false,
    } as {
      survivors: TownUnits;
      defendingUnits: Dict<number>;
      losses: Dict<number>;
      hasLosses: boolean;
    });

    const attackResult = unitArrays.attack.reduce((result, [key, val]) => {
      result.units[key].outside -= val;
      result.combatUnits[key] = val;
      return result;
    }, { units: { ...originTown.units }, combatUnits: {} });

    const targetOutcome: TargetOutcome = defenseResult.hasLosses ? {
      units: defenseResult.survivors,
      resources: targetTown.getResources(movement.endsAt, targetTown.updatedAt),
      loyalty: targetTown.getLoyalty(movement.endsAt, targetTown.updatedAt),
    } : null;

    return MovementResolver.saveCombatOutcome(movement, targetTown, originTown, {
      origin: {
        town: { units: attackResult.units },
      },
      target: targetOutcome,
      report: {
        outcome: CombatOutcome.defense,
        origin: {
          units: attackResult.combatUnits,
          losses: attackResult.combatUnits,
        },
        target: {
          units: defenseResult.defendingUnits,
          losses: defenseResult.losses,
        },
      },
    });
  }

  static async saveCombatOutcome(movement: Movement, targetTown: Town, originTown: Town, attackOutcome: AttackOutcome): Promise<ResolvedAttack> {
    const endsAt = +movement.endsAt + (+movement.endsAt - +movement.createdAt);
    const trx = await transaction.start(knexDb.world);
    let newMovement: Movement = null;
    try {
      await movement.$query(trx).delete();

      const report = await Report.query(trx).insert({
        ...attackOutcome.report,
        originTownId: originTown.id,
        originPlayerId: originTown.playerId,
        targetTownId: targetTown.id,
        targetPlayerId: targetTown.playerId,
      });

      if (attackOutcome.origin.movement) {
        newMovement = await Movement.query(trx).insert({
          ...attackOutcome.origin.movement,
          endsAt,
          type: MovementType.return,
          originTownId: targetTown.id,
          targetTownId: originTown.id,
        });
      }

      if (attackOutcome.target) {
        await targetTown.$query(trx)
          .patch({
            ...attackOutcome.target,
            updatedAt: +movement.endsAt,
          })
          .context({
            resourcesUpdated: true,
            loyaltyUpdated: true,
          });
      }

      if (attackOutcome.origin.town) {
        await originTown.$query(trx)
          .patch({
            ...attackOutcome.origin.town,
            updatedAt: +movement.endsAt,
          });
      }
      await trx.commit();
      return { originTown, targetTown, report, movement: newMovement };
    } catch (err) {
      await trx.rollback();
      throw err;
    }
  }

  static getHaul(townRes: Resources, maxHaul: number) {
    const totalRes = townRes.wood + townRes.clay + townRes.iron;
    const hauledAll = maxHaul > totalRes;
    return Object.entries(townRes).reduce((data, [key, val]) => {
      const resHaul = hauledAll ? val : maxHaul * (val / totalRes);
      data.resources[key] = val - resHaul;
      data.haul[key] = resHaul;
      return data;
    }, { resources: {}, haul: {} } as { resources: Resources, haul: Resources  });
  }

  static calculateAttackStrength(units: MovementUnit[]): CombatStrength {
    return units.reduce((result, [key, val]) => {
      const unit = worldData.unitMap[key];
      const unitAttack = unit.combat.attack * val;
      result[unit.attackType] += unitAttack;

      return result;
    }, { ...defaultStrength });
  }

  static calculateDefenseStrength(units: Array<[string, TownUnit]>): CombatStrength {
    return units.reduce((result, [key, val]) => {
      const unit = worldData.unitMap[key];
      result.general += unit.combat.defense.general * val.inside;
      result.cavalry += unit.combat.defense.cavalry * val.inside;
      result.archer += unit.combat.defense.archer * val.inside;

      return result;
    }, { ...defaultStrength });
  }

  static calculateLoss(winner: number, loser: number): number {
    return 1 - (((loser / winner) ** 0.5) / (winner / loser));
  }

  static getLoyaltyChange(units: number) {
    let change = 0;
    const changeRange = worldData.world.loyaltyReductionRange[1] - worldData.world.loyaltyReductionRange[0];
    for (let i = 0; i < units; i++) {
      change += worldData.world.loyaltyReductionRange[0] + Math.round(Math.random() * changeRange);
    }
    return change;
  }
}
