import * as Knex from 'knex';
import { Transaction } from 'objection';
import { WorldData as WorldDataModel, Dict } from 'strat-ego-common';

import { Building } from '../building/building';
import { Unit } from '../unit/unit';
import { World } from './world';
import { knexDb } from '../../sqldb';
import { logger } from '../../logger';
import { getWorld, getBuildings, getUnits, updateWorld } from './worldQueries';

export class WorldData {
  public world: World;
  public units: Unit[] = [];
  public unitMap: Dict<Unit> = {};
  public buildings: Building[] = [];
  public buildingMap: Dict<Building> = {};

  get fullWorld() {
    return {
      world: this.world,
      units: this.units,
      unitMap: this.unitMap,
      buildings: this.buildings,
      buildingMap: this.buildingMap,
    };
  }

  public async readWorld(name: string) {
    try {
      const [world, buildings, units] = await Promise.all([
        getWorld(name),
        getBuildings(),
        getUnits(),
      ]);

      this.world = world;

      this.buildings = buildings;
      this.buildingMap = buildings.reduce((map, item) => ({ ...map, [item.name]: item }), {});

      this.units = units;
      this.unitMap = units.reduce((map, item) => ({ ...map, [item.name]: item }), {});
    } catch (err) {
      logger.error(err, 'Error while reading world data.');
      throw err;
    }
  }

  // Note: this gets called on a time basis and running out of locations, as a result of this
  // updating lastExpansion it will considerably hasten expansion rate on faster growth
  public async increaseRing(name: string, trx: Transaction | Knex = knexDb.main) {
    try {
      await updateWorld(
        this.world,
        {
          currentRing: this.world.currentRing + 1,
          lastExpansion: +this.world.lastExpansion + +this.world.expansionRate,
        },
        trx,
      );

      logger.info('increased current ring');
    } catch (err) {
      logger.error(err, 'Error while updating world ring size.');
      throw err;
    }
  }
}

export const worldData = new WorldData();
