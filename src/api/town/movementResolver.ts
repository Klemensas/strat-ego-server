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
  updateTown,
  createSupport,
  createMovement,
  createReport,
  deleteSupport,
  deleteMovementItem,
  deleteMovement,
  updateStationedSupport,
} from './townQueries';
import { PlayerSocket } from '../player/playerSocket';
import { scoreTracker } from '../player/playerScore';

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
  conquered?: boolean;
}

export interface RemovedItems {
  ids: number[];
  townIds: number[];
}

export interface UpdatedItems extends RemovedItems {
  changes: any;
}

export interface RemovedTownItems {
  originSupport?: RemovedItems;
  targetSupport?: RemovedItems;
  originMovements?: RemovedItems;
}

export interface UpdatedTownItems {
  targetSupport?: UpdatedItems;
}

export interface InvolvedTownChanges {
  removed: RemovedTownItems;
  updated: UpdatedTownItems;
}

export interface ResolvedAttack {
  originTown: Town;
  targetTown: Town;
  report: Report;
  movement?: Movement;
  notifications: InvolvedTownChanges;
}

export interface SupportChange {
  id: number;
  originTownId: number;
  initialUnits: Dict<number>;
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
    let emittedTown = 'targetTown';
    let returnedTown = 'originTown';
    // Pick arguments based on whether caller is origin
    if (isOrigin) {
      emittedTown = 'originTown';
      returnedTown = 'targetTown';
      result = await MovementResolver.resolveAttack(movement, otherTown, town);
    } else {
      result = await MovementResolver.resolveAttack(movement, town, otherTown);
    }

    if (result.movement) {
      townQueue.addToQueue(result.movement);
    }
    // Use report playerIds since towns might be updated already
    PlayerSocket.emitToPlayer(result.report.originPlayerId, { side: 'origin', report: result.report }, 'player:addReport');
    PlayerSocket.emitToPlayer(result.report.targetPlayerId, { side: 'target', report: result.report }, 'player:addReport');
    // Town was conquered
    if (result.originTown.playerId === result.targetTown.playerId) {
      TownSocket.townConquered(result.targetTown);
      worldData.mapManager.townConquered(result.targetTown, result.originTown.location);
      scoreTracker.updateScore(result.report.originPlayerId, result.targetTown.score);
      scoreTracker.updateScore(result.report.targetPlayerId, -result.targetTown.score);
    } else {
      TownSocket.emitToTownRoom(result[emittedTown].id, result[emittedTown], 'town:update');
    }
    TownSocket.notifyInvolvedCombatChanges(result.notifications);

    return result[returnedTown];
  }

  static async resolveAttack(movement: Movement, targetTown: Town, originTown: Town) {
    // Note targetTowns.units is an object so unitArrays.defense has a ref
    const unitArrays: CombatantList = {
      attack: Object.entries(movement.units),
      defense: Object.entries(targetTown.units),
    };

    const attackStrength = MovementResolver.calculateAttackStrength(unitArrays.attack);

    const defenseStrength = MovementResolver.calculateDefenseStrength(unitArrays.defense);
    const supportStrength = MovementResolver.calculateSupportStrength(targetTown.targetSupport);

    supportStrength.total = supportStrength.general + supportStrength.cavalry + supportStrength.archer;
    attackStrength.total = attackStrength.general + attackStrength.cavalry + attackStrength.archer;
    defenseStrength.total = defenseStrength.general + defenseStrength.cavalry + defenseStrength.archer;
    const totalDefenseStrength: CombatStrength = {
      general: defenseStrength.general + supportStrength.general,
      cavalry: defenseStrength.cavalry + supportStrength.cavalry,
      archer: defenseStrength.archer + supportStrength.archer,
      total: defenseStrength.total + supportStrength.total,
    };

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
      await deleteMovementItem(movement, trx);
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

      await deleteMovementItem(movement, trx);
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
    const reportDefense = targetTown.targetSupport.reduce((result: Dict<number>, { units }): Dict<number> => {
      Object.entries(units).forEach(([key, val]) => result[key] = result[key] + val || val);
      return result;
    }, { ...defenseResult.combatUnits });
    targetOutcome.units = defenseResult.units;

    const conquered = loyalty <= 0;
    if (conquered) {
      attackResult.unitChange = true;
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
          units: reportDefense,
          losses: reportDefense,
        },
        haul: {
          maxHaul: attackResult.maxHaul,
          haul,
        },
        loyaltyChange: [targetLoyalty, loyalty],
      },
      conquered,
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
    const { supportChanges, reportDefense } = targetTown.targetSupport.reduce((result, item) => {
      const { alive, units, changed } = Object.entries(item.units).reduce((r, [key, val]) => {
        const count = Math.round(val * winnerSurvival);
        const unitsChanged = count !== val;
        const losses = +unitsChanged * (val - count);

        result.reportDefense.units[key] = result.reportDefense.units[key] + count || count;
        result.reportDefense.losses[key] = result.reportDefense.losses[key] + losses || losses;

        r.alive = r.alive || !!count;
        r.changed =  r.changed || unitsChanged;
        r.units[key] = count;
        return r;
      }, { alive: false, units: {}, changed: false });
      if (changed) {
        result.supportChanges.push({
          changed,
          id: item.id,
          originTownId: item.originTownId,
          units: !alive ? null : units,
        });
      }
      return result;
    }, {
      supportChanges: [],
      reportDefense: {
        units: { ...defenseResult.defendingUnits },
        losses: { ...defenseResult.losses },
      },
    });

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
          target: reportDefense,
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
    const removedTownItems: RemovedTownItems = {};
    const updatedTownItems: UpdatedTownItems = {};
    try {
      await deleteMovementItem(movement, trx);

      const report = await createReport({
        ...attackOutcome.report,
        originTownId: originTown.id,
        originPlayerId: originTown.playerId,
        targetTownId: targetTown.id,
        targetPlayerId: targetTown.playerId,
      }, trx);
      report.originTown = { id: originTown.id, location: originTown.location, name: originTown.name };
      report.targetTown = { id: targetTown.id, location: targetTown.location, name: targetTown.name };

      // Victorious return movement
      if (attackOutcome.origin.movement) {
        const query = await createMovement(
          targetTown,
          originTown,
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

      const promises = [];
      const deletedSupport = [];
      // If target has any losses
      if (attackOutcome.target) {
        // Remove all support if target lost
        if (report.outcome === CombatOutcome.attack) {
          removedTownItems.targetSupport = targetTown.targetSupport.reduce((result, { id, originTownId }) => {
            result.ids.push(id);
            result.townIds.push(originTownId);
            return result;
          }, { ids: [], townIds: [] });
          deletedSupport.push(...removedTownItems.targetSupport.ids);
          targetTown.targetSupport = [];

          if (attackOutcome.conquered) {
            attackOutcome.target.playerId = originTown.playerId;
            attackOutcome.target.loyalty = worldData.world.initialLoyalty;
            attackOutcome.target.units = Town.resetInsideUnits(targetTown.units);

            removedTownItems.originSupport = targetTown.originSupport.reduce((result, { id, targetTownId }) => {
              result.ids.push(id);
              result.townIds.push(targetTownId);
              return result;
            }, { ids: [], townIds: [] });
            deletedSupport.push(...removedTownItems.originSupport.ids);
            targetTown.originSupport = [];

            removedTownItems.originMovements = targetTown.originMovements.reduce((result, { id, type, targetTownId }) => {
              if (type === MovementType.return) { return result; }

              result.ids.push(id);
              result.townIds.push(targetTownId);
              return result;
            }, { ids: [], townIds: [] });
            targetTown.originMovements = [];

            promises.push(deleteMovement(removedTownItems.originMovements.ids, trx));
          }
          promises.push(deleteSupport(deletedSupport, trx));
        } else {
          const supportChanges = support.reduce((result, { id, units, originTownId }) => {
            if (units) {
              result.updatedSupport.ids.push(id);
              result.updatedSupport.changes.push({ units });
              result.updatedSupport.townIds.push(originTownId);
              result.updates.push(updateStationedSupport(targetTown, id, { units }, trx));
            } else {
              result.deletedSupport.ids.push(id);
              result.deletedSupport.townIds.push(originTownId);
            }
            return result;
          }, {
            deletedSupport: { ids: [], townIds: [] },
            updatedSupport: { ids: [], townIds: [], changes: [] },
            updates: [],
          });

          updatedTownItems.targetSupport = supportChanges.updatedSupport;
          removedTownItems.targetSupport = supportChanges.deletedSupport;

          await Promise.all(supportChanges.updates);
          targetTown.targetSupport = targetTown.targetSupport.filter(({ id }) => !supportChanges.deletedSupport.ids.includes(id));
          promises.push(deleteSupport(supportChanges.deletedSupport.ids, trx));
        }

        await Promise.all(promises);
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

      return {
        originTown,
        targetTown,
        report,
        movement: newMovement,
        notifications: {
          removed: removedTownItems,
          updated: updatedTownItems,
        },
      };
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
