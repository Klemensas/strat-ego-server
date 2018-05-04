import { TownUnit, CombatStrength, Resources, MovementType, CombatOutcome, Haul, Dict, Profile } from 'strat-ego-common';
import { transaction } from 'objection';

import { knexDb } from '../../sqldb';
import { worldData } from '../world/worldData';
import { Town } from './town';
import { Movement } from './movement';
import { Report } from './report';
import { townQueue } from '../townQueue';
import { TownSocket } from './townSocket';
import { TownSupport } from './townSupport';
import {
  deleteMovement,
  updateTown,
  createSupport,
  createMovement,
  deleteAllTownSupport,
  deleteTownSupport,
  updateTownSupport,
  createReport,
} from './townQueries';

const defaultStrength: CombatStrength = { general: 0, cavalry: 0, archer: 0 };
const combatTypes = ['general', 'cavalry', 'archer'];

export interface OriginOutcome {
  movement?: Partial<Movement>;
}

export interface TargetOutcome {
  playerId?: number;
  resources: Resources;
  loyalty: number;
  units?: Dict<TownUnit>;
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

export interface SupportChange {
  id: number;
  units: Dict<number>;
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

  static async updateMissingTown(townId: number, time: number) {
    const { town, processed } = await Town.processTownQueues(townId, time);
    townQueue.removeFromQueue(...processed);
    return town;
  }

  // Note: emitting to socket here might result to multiple updates if the town has multiple unprocessed queues
  static async fetchTownAndResolveAttack(movement: Movement, town: Town) {
    const isOrigin = movement.originTownId === town.id;
    const missingTown = isOrigin ? movement.targetTownId : movement.originTownId;

    const otherTown = await MovementResolver.updateMissingTown(missingTown, +movement.endsAt - 1);

    let result: ResolvedAttack;
    if (isOrigin) {
      result = await MovementResolver.resolveAttack(movement, otherTown, town);
      if (result.movement) {
        townQueue.addToQueue(result.movement);
      }
      TownSocket.emitToTownRoom(result.targetTown.id, result.targetTown, 'town:update');
      return result.originTown;
    } else {
      result = await MovementResolver.resolveAttack(movement, town, otherTown);
      TownSocket.emitToTownRoom(result.originTown.id, result.originTown, 'town:update');
      return result.targetTown;
    }
  }

  static async resolveAttack(movement: Movement, targetTown: Town, originTown: Town) {
    const unitArrays: CombatantList = {
      attack: Object.entries(movement.units),
      defense: Object.entries(targetTown.units),
    };

    const attackStrength = MovementResolver.calculateAttackStrength(unitArrays.attack);

    const defenseStrength = MovementResolver.calculateDefenseStrength(unitArrays.defense);
    const supportStrength = MovementResolver.calculateSupportStrength(targetTown.targetSupport);
    const totalDefenseStrength: CombatStrength = {
      general: defenseStrength.general + supportStrength.general,
      cavalry: defenseStrength.cavalry + supportStrength.cavalry,
      archer: defenseStrength.archer + supportStrength.archer,
      total: defenseStrength.total + supportStrength.total,
    };

    supportStrength.total = supportStrength.general + supportStrength.cavalry + supportStrength.archer;
    attackStrength.total = attackStrength.general + attackStrength.cavalry + attackStrength.archer;
    defenseStrength.total = defenseStrength.general + defenseStrength.cavalry + defenseStrength.archer;

    if (totalDefenseStrength.total === 0) {
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
      sides[1].strength += totalDefenseStrength[type] * attackTypePercentages[type] * wallBonus;
      return sides;
    }, [{ side: CombatOutcome.attack, strength: 0 }, { side: CombatOutcome.defense, strength: 0 }]).sort((a, b) => b.strength - a.strength);

    const winnerSurvival = MovementResolver.calculateSurvivalPercent(winner.strength, losser.strength);

    const outcomeHandler = winner.side === CombatOutcome.attack ? MovementResolver.handleAttackWin : MovementResolver.handleDefenseWin;
    return outcomeHandler(unitArrays, winnerSurvival, movement, targetTown, originTown);
  }

  static async resolveReturn(movement: Movement, town: Town) {
    const units = Object.entries(movement.units).reduce((result, [key, value]) => {
      result[key].inside += value;
      return result;
    }, { ...town.units });

    const resources = town.getResources(movement.endsAt);
    const maxRes = town.getMaxRes();
    if (!!movement.haul) {
      resources.wood = Math.min(maxRes, resources.wood + movement.haul.wood);
      resources.clay = Math.min(maxRes, resources.clay + movement.haul.clay);
      resources.iron = Math.min(maxRes, resources.iron + movement.haul.iron);
    }

    const trx = await transaction.start(knexDb.world);
    try {
      await deleteMovement(movement, trx);
      await updateTown(
        town,
        {
          units,
          resources,
          updatedAt: +movement.endsAt,
        },
        {
          resourcesUpdated: true,
        },
        trx,
      );
      await trx.commit();

      town.targetMovements = town.targetMovements.filter(({ id }) => id !== movement.id);
      return town;
    } catch (err) {
      await trx.rollback();
      throw err;
    }
  }

  // Note: emitting to socket here might result to multiple updates if the town has multiple unprocessed queues
  static async resolveSupport(movement: Movement, town: Town) {
    const trx = await transaction.start(knexDb.world);
    try {
      const isOrigin = movement.originTownId === town.id;
      const missingTown = isOrigin ? movement.targetTownId : movement.originTownId;
      const otherTown = await MovementResolver.updateMissingTown(missingTown, +movement.endsAt - 1);
      const originProfile = movement.originTown ||
        isOrigin ? { id: town.id, name: town.name, location: town.location } : { id: otherTown.id, name: otherTown.name, location: otherTown.location };
      const targetProfile = movement.targetTown ||
        !isOrigin ? { id: town.id, name: town.name, location: town.location } : { id: otherTown.id, name: otherTown.name, location: otherTown.location };

      await deleteMovement(movement, trx);
      const townSupport = await createSupport({
        units: movement.units,
        originTownId: movement.originTownId,
        originTown: originProfile,
        targetTownId: movement.targetTownId,
        targetTown: targetProfile,
      }, trx);

      await trx.commit();

      if (isOrigin) {
        otherTown.targetSupport.push(townSupport);
        otherTown.targetMovements = otherTown.targetMovements.filter(({ id }) => id !== movement.id);
        town.originMovements = town.originMovements.filter(({ id }) => id !== movement.id);
        town.originSupport.push(townSupport);
      } else {
        otherTown.originSupport.push(townSupport);
        otherTown.originMovements = otherTown.originMovements.filter(({ id }) => id !== movement.id);
        town.targetMovements = town.targetMovements.filter(({ id }) => id !== movement.id);
        town.targetSupport.push(townSupport);
      }

      TownSocket.emitToTownRoom(otherTown.id, otherTown, 'town:update');
      return town;
    } catch (err) {
      await trx.rollback();
      throw err;
    }
  }

  static handleAttackWin(unitArrays: CombatantList, winnerSurvival: number, movement: Movement, targetTown: Town, originTown: Town) {
    const targetResources: Resources = targetTown.getResources(movement.endsAt);
    const targetLoyalty = targetTown.getLoyalty(movement.endsAt);

    const attackResult = unitArrays.attack.reduce((result, [key, val]) => {
      const survived = Math.round(val * winnerSurvival);
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

    const { resources, haul } = MovementResolver.getHaul(targetResources, attackResult.maxHaul);
    const originOutcome: OriginOutcome = {
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
      targetOutcome.units = Town.getInitialUnits();
      attackResult.unitChange = true;
    }

    if (attackResult.unitChange && isConquered) {
      originOutcome.movement.units.noble -= 1;
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

  static handleDefenseWin(unitArrays: CombatantList, winnerSurvival: number, movement: Movement, targetTown: Town, originTown: Town) {
    const defenseResult = unitArrays.defense.reduce((outcome, [key, val]) => {
      const survived = Math.round(val.inside * winnerSurvival);
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
      survivors: Dict<TownUnit>;
      defendingUnits: Dict<number>;
      losses: Dict<number>;
      hasLosses: boolean;
    });
    const supportChanges: SupportChange[] = targetTown.targetSupport.reduce((result, item) => {
      const { alive, units, changed } = Object.entries(item.units).reduce((r, [key, val]) => {
        const count = Math.round(val * winnerSurvival);
        r.alive = r.alive || !!count;
        r.changed =  r.changed || count !== val;
        r.units[key] = count;
        return r;
      }, { alive: false, units: {}, changed: false });
      if (changed) {
        result.push({
          changed,
          id: item.id,
          units: !alive ? null : units,
        });
      }
      return result;
    }, []);

    const attackResult = unitArrays.attack.reduce((result, [key, val]) => {
      result.combatUnits[key] = val;
      return result;
    }, { units: { ...originTown.units }, combatUnits: {} });

    const targetOutcome: TargetOutcome = defenseResult.hasLosses ? {
      units: defenseResult.survivors,
      resources: targetTown.getResources(movement.endsAt, targetTown.updatedAt),
      loyalty: targetTown.getLoyalty(movement.endsAt, targetTown.updatedAt),
    } : null;

    return MovementResolver.saveCombatOutcome(
      movement,
      targetTown,
      originTown,
      {
        origin: {},
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
      },
      supportChanges,
    );
  }

  static async saveCombatOutcome(
    movement: Movement,
    targetTown: Town,
    originTown: Town,
    attackOutcome: AttackOutcome,
    support: SupportChange[] = [],
  ): Promise<ResolvedAttack> {
    const endsAt = +movement.endsAt + (+movement.endsAt - +movement.createdAt);
    const trx = await transaction.start(knexDb.world);
    let newMovement: Movement = null;
    try {
      await deleteMovement(movement, trx);

      const report = await createReport({
        ...attackOutcome.report,
        originTownId: originTown.id,
        originPlayerId: originTown.playerId,
        targetTownId: targetTown.id,
        targetPlayerId: targetTown.playerId,
      }, trx);

      // Victorious return movement
      if (attackOutcome.origin.movement) {
        const query = await createMovement(
          originTown,
          targetTown,
          {
            ...attackOutcome.origin.movement,
            endsAt,
            type: MovementType.return,
          },
          trx,
        );
        newMovement = query.movement;
        originTown.targetMovements.push(newMovement);
      }

      // Target losses
      if (attackOutcome.target) {
        // Remove all support if target lost
        if (report.outcome === CombatOutcome.attack) {
          await deleteAllTownSupport(targetTown, trx);
        }
        await Promise.all(support.map((item) => item.units ?
          updateTownSupport(targetTown, item.id, { units: item.units }, trx) :
          deleteTownSupport(targetTown, item.id, trx),
        ));
        await updateTown(
          targetTown,
          {
            ...attackOutcome.target,
            updatedAt: +movement.endsAt,
          },
          {
            resourcesUpdated: true,
            loyaltyUpdated: true,
          },
          trx,
        );
      }

      await trx.commit();

      originTown.originMovements = originTown.originMovements.filter(({ id }) => id !== movement.id);
      targetTown.targetMovements = targetTown.targetMovements.filter(({ id }) => id !== movement.id);

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

  static calculateAttackStrength(units: Array<[string, number]>): CombatStrength {
    return units.reduce((result, [key, val]) => {
      const unit = worldData.unitMap[key];
      const unitAttack = unit.combat.attack * val;
      result[unit.attackType] += unitAttack;

      return result;
    }, { ...defaultStrength });
  }

  static calculateDefenseStrength(townUnits: Array<[string, TownUnit]>): CombatStrength {
    return townUnits.reduce((result, [key, val]) => {
      const unit = worldData.unitMap[key];
      result.general += unit.combat.defense.general * val.inside;
      result.cavalry += unit.combat.defense.cavalry * val.inside;
      result.archer += unit.combat.defense.archer * val.inside;

      return result;
    }, { ...defaultStrength });
  }

  static calculateSupportStrength(support: Array<Partial<TownSupport>>): CombatStrength {
    return support.reduce((result, { units }) => {
      Object.entries(units).forEach(([key, val]) => {
        const unit = worldData.unitMap[key];
        result.general += unit.combat.defense.general * val;
        result.cavalry += unit.combat.defense.cavalry * val;
        result.archer += unit.combat.defense.archer * val;
      });
      return result;
    }, { general: 0, archer: 0, cavalry: 0 });
  }

  static calculateSurvivalPercent(winner: number, loser: number): number {
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
