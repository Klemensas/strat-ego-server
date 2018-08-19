import { transaction } from 'objection';
import { TownBuildings, Coords } from 'strat-ego-common';
import * as seedrandom from 'seedrandom';

import { knexDb } from '../../sqldb';
import { getTowns, upsertTowns } from './townQueries';
import { WorldData } from '../world/worldData';
import { Town } from './town';
import { logger } from '../../logger';

export class TownGrowth {
  constructor(private worldData: WorldData) {}

  public async checkGrowth(time = Date.now()) {
    const nextGrowth = +this.worldData.world.townLastGrowth + this.worldData.world.townGrowthInterval;
    const timeLeft = nextGrowth - time;
    if (timeLeft > 0) {
      setTimeout(() => this.checkGrowth(), timeLeft);
      return;
    }

    try {
      await this.growTowns(nextGrowth);
      return this.checkGrowth();
    } catch (err) {
      logger.error(err, 'Errored while attempting to grow abandoned towns, retrying');
      return this.checkGrowth(time);
    }
  }

  public async growTowns(growthTime: number) {
    const worldTrx = await transaction.start(knexDb.world);
    const mainTrx = await transaction.start(knexDb.main);
    try {
      const towns = await getTowns({ playerId: null }, worldTrx);
      const grownTowns = towns.reduce((result, town) => {
        const buildings = this.growRandomBuilding(town, growthTime);
        if (buildings) {
          result.push({
            ...town,
            resources: town.getResources(growthTime),
            loyalty: town.getLoyalty(growthTime),
            buildings,
            updatedAt: growthTime,
          });
        }
        return result;
      }, []);

      if (grownTowns.length) {
        const updateResult = await upsertTowns(grownTowns, { resourcesUpdated: true, loyaltyUpdated: true, updateScore: true }, worldTrx);
      }
      await this.worldData.updateGrowth(mainTrx);

      await worldTrx.commit();
      await mainTrx.commit();
    } catch (err) {
      await worldTrx.rollback();
      await mainTrx.rollback();
      throw err;
    }
  }

  public growRandomBuilding(town: Town, growthTime: number): TownBuildings {
    const rng = seedrandom(`${growthTime}.${town.id}`);
    const availableBuildings = this.worldData.buildings.filter(({ name, levels, requirements }) =>
      town.doesMeetRequirements(requirements, 'buildings') && levels.max > town.buildings[name].level);
    if (!availableBuildings.length) { return null; }

    const targetIndex = Math.floor(rng.quick() * availableBuildings.length);
    const building = availableBuildings[targetIndex];

    return {
      ...town.buildings,
      [building.name]: {
        level: town.buildings[building.name].level + 1,
        queued: 0,
      },
    };
  }

  public async generateRingTowns(coords: Coords[], seedBase: string | number) {
    const trx = await transaction.start(knexDb.world);
    try {
      const [emptyCoords, targetTowns] = coords.reduce((result, coord) => {
        const isTown = (seedrandom(`${seedBase}.${coord.join(',')}`).quick() < this.worldData.world.barbPercent);
        if (isTown) {
          result[1].push({
            location: coord,
          });
        } else {
          result[0].push(coord);
        }
        return result;
      }, [[], []]);

      const towns = targetTowns && targetTowns.length ? await upsertTowns(targetTowns, {}, trx) : [];
      await trx.commit();
      return {
        towns,
        coords: emptyCoords,
      };
    } catch (err) {
      logger.error(err, 'Errored while generating towns for ring');
      await trx.rollback();
      const availableCoords = await this.worldData.mapManager.getAvailableCoords(coords);
      return {
        towns: [],
        coords: availableCoords,
      };
    }
  }
}
