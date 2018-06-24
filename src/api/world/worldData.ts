import * as Knex from 'knex';
import { Transaction } from 'objection';
import { Dict } from 'strat-ego-common';

import { Building } from '../building/building';
import { Unit } from '../unit/unit';
import { World } from './world';
import { knexDb } from '../../sqldb';
import { logger } from '../../logger';
import { getWorld, getBuildings, getUnits, updateWorld } from './worldQueries';
import { TownGrowth } from '../town/townGrowth';
import { MapManager } from '../map/mapManager';

export class WorldData {
  public world: World;
  public units: Unit[] = [];
  public unitMap: Dict<Unit> = {};
  public buildings: Building[] = [];
  public buildingMap: Dict<Building> = {};
  public townGrowth: TownGrowth;
  public mapManager: MapManager;

  public get fullWorld() {
    return {
      world: this.world,
      units: this.units,
      unitMap: this.unitMap,
      buildings: this.buildings,
      buildingMap: this.buildingMap,
    };
  }

  constructor(mapManagerConstructor: new (WorldData: WorldData) => MapManager, townGrowthConstructor: new (WorldData: WorldData) => TownGrowth) {
    this.mapManager = new mapManagerConstructor(this);
    this.townGrowth = new townGrowthConstructor(this);
  }

  public async initialize(name: string) {
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

      await this.townGrowth.checkGrowth();
      await this.mapManager.initialize();
    } catch (err) {
      logger.error(err, 'Error while reading world data.');
      throw err;
    }
  }

  // Note: this gets called on a time basis and running out of locations, as a result of this
  // updating lastExpansion it will considerably hasten expansion rate on faster growth
  public async increaseRing(trx: Transaction | Knex = knexDb.main) {
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

  public async updateGrowth(trx: Transaction | Knex = knexDb.main) {
    return updateWorld(this.world, { townLastGrowth: +this.world.townLastGrowth + this.world.townGrowthInterval }, trx);
  }
}

export const worldData = new WorldData(MapManager, TownGrowth);
