import * as Knex from 'knex';
import { WorldData as WorldDataModel, Dict } from 'strat-ego-common';

import { Building } from '../building/building';
import { Unit } from '../unit/unit';
import { World } from './world';
import { knexDb } from '../../sqldb';
import { logger } from '../../logger';

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
      const world = await World.query(knexDb.main).findById(name);
      const buildings = await Building.query(knexDb.world);
      const units = await Unit.query(knexDb.world);

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
  public async increaseRing(name: string, query: Knex.Transaction | Knex = knexDb.main) {
    try {
      await this.world.$query(query)
        .patch({
          currentRing: this.world.currentRing + 1,
          lastExpansion: +this.world.lastExpansion + +this.world.expansionRate,
        });

      logger.info('increased current ring');
    } catch (err) {
      logger.error(err, 'Error while updating world ring size.');
      throw err;
    }
  }
}

export const worldData = new WorldData();
