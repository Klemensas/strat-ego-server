import * as Knex from 'knex';
import { transaction } from 'objection';
import { Resources, TownBuildings, Coords, Requirements, QueueType, MovementType, TownUnit, Dict } from 'strat-ego-common';

import { BaseModel } from '../../sqldb/baseModel';
import { knexDb } from '../../sqldb';
import { Player } from '../player/player';
import { worldData } from '../world/worldData';
import { BuildingQueue } from '../building/buildingQueue';
import { UnitQueue } from '../unit/unitQueue';
import { logger } from '../../logger';
import { Movement } from './movement';
import { MovementResolver } from './movementResolver';
import { TownSupport } from './townSupport';
import { getTownWithItems } from './townQueries';
import { ProfileService } from '../profile/profileService';
import { TownSocket } from './townSocket';

export interface ProcessingResult {
  town: Town;
  processed: TownQueue[];
}

export type TownQueue = Partial<BuildingQueue> | Partial<UnitQueue> | Partial<Movement>;

export class Town extends BaseModel {
  readonly id?: number;
  name?: string;
  loyalty?: number;
  location?: Coords;
  production?: Resources;
  resources?: Resources;
  units?: Dict<TownUnit>;
  buildings?: TownBuildings;
  score?: number;

  // Associations
  playerId?: number;
  player?: Partial<Player>;
  buildingQueues?: Array<Partial<BuildingQueue>>;
  unitQueues?: Array<Partial<UnitQueue>>;
  originMovements?: Array<Partial<Movement>>;
  targetMovements?: Array<Partial<Movement>>;
  originSupport?: Array<Partial<TownSupport>>;
  targetSupport?: Array<Partial<TownSupport>>;

  static tableName = 'Town';

  static relationMappings = {
    player: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: 'player',
      join: {
        from: 'Town.playerId',
        to: 'Player.id',
      },
    },
    buildingQueues: {
      relation: BaseModel.HasManyRelation,
      modelClass: 'buildingQueue',
      join: {
        from: 'Town.id',
        to: 'BuildingQueue.townId',
      },
    },
    unitQueues: {
      relation: BaseModel.HasManyRelation,
      modelClass: 'unitQueue',
      join: {
        from: 'Town.id',
        to: 'UnitQueue.townId',
      },
    },
    originMovements: {
      relation: BaseModel.HasManyRelation,
      modelClass: 'movement',
      join: {
        from: 'Town.id',
        to: 'Movement.originTownId',
      },
    },
    targetMovements: {
      relation: BaseModel.HasManyRelation,
      modelClass: 'movement',
      join: {
        from: 'Town.id',
        to: 'Movement.targetTownId',
      },
    },
    originReports: {
      relation: BaseModel.HasManyRelation,
      modelClass: 'report',
      join: {
        from: 'Town.id',
        to: 'Report.originTownId',
      },
    },
    targetReports: {
      relation: BaseModel.HasManyRelation,
      modelClass: 'report',
      join: {
        from: 'Town.id',
        to: 'Report.targetTownId',
      },
    },
    originSupport: {
      relation: BaseModel.HasManyRelation,
      modelClass: 'townSupport',
      join: {
        from: 'Town.id',
        to: 'TownSupport.originTownId',
      },
    },
    targetSupport: {
      relation: BaseModel.HasManyRelation,
      modelClass: 'townSupport',
      join: {
        from: 'Town.id',
        to: 'TownSupport.targetTownId',
      },
    },
  };

  getProduction(buildings = this.buildings) {
    const buildingData = worldData.buildingMap;
    return {
      wood: worldData.world.baseProduction + buildingData.wood.data[buildings.wood.level].production,
      clay: worldData.world.baseProduction + buildingData.clay.data[buildings.clay.level].production,
      iron: worldData.world.baseProduction + buildingData.iron.data[buildings.iron.level].production,
    };
  }

  doesMeetRequirements(requirements: Requirements[], type: string) {
    return requirements ? requirements.every(({ item, level }) => this[type][item].level >= level) : true;
  }

  getMaxRes() {
    return worldData.buildingMap.storage.data[this.buildings.storage.level].storage;
  }

  getResources(now: string | number, previous = this.updatedAt, town = this) {
    const hoursPast = (+now - +previous) / 3600000;
    const maxRes = town.getMaxRes();
    return {
      wood: Math.min(maxRes, town.resources.wood + town.production.wood * hoursPast),
      clay: Math.min(maxRes, town.resources.clay + town.production.clay * hoursPast),
      iron: Math.min(maxRes, town.resources.iron + town.production.iron * hoursPast),
    };
  }

  getLoyalty(now: string | number, previous = this.updatedAt, town = this) {
    if (town.loyalty === 100) { return 100; }

    const growthPerHour = worldData.world.loyaltyRegeneration;
    const timePast = (+now - +previous) / 3600000;
    const growth = growthPerHour * timePast;
    return Math.min(100, town.loyalty + growth);
  }

  hasEnoughResources(target: Resources) {
    return this.resources.wood >= target.wood && this.resources.clay >= target.clay && this.resources.iron >= target.iron;
  }

  async processQueues(queues: TownQueue[], processed: TownQueue[] = []): Promise<ProcessingResult> {
    if (!queues.length) { return { town: this, processed }; }

    const item = queues.shift();
    const queueType = item.constructor.name as QueueType;
    try {
      const town: Town = await this[`process${queueType}`](item);

      return town.processQueues(queues, [...processed, item]);
    } catch (error) {
      throw { error, processed };
    }
  }

  async processBuildingQueue(item: BuildingQueue) {
    const trx = await transaction.start(knexDb.world);
    const building = this.buildings[item.name];
    const level = building.level + 1;
    const update: Partial<Town> = {
      buildings: {
        ...this.buildings,
        [item.name]: {
          level,
          queued: building.queued === level ? 0 : building.queued,
        },
      },
      resources: this.getResources(item.endsAt),
      updatedAt: +item.endsAt,
    };
    // Recalculate resource data on production building
    if (worldData.buildingMap[item.name].data[0].hasOwnProperty('production')) {
      update.production = this.getProduction(update.buildings);
    }
    try {
      await item.$query(trx).delete();
      await this.$query<Town>(trx)
        .patch(update)
        .context({ resourcesUpdated: true, updateScore: true });
      await trx.commit();

      ProfileService.updateTownProfile(this.id, { score: this.score });
      this.buildingQueues = this.buildingQueues.filter(({ id }) => id !== item.id);
      TownSocket.emitToTownRoom(this.id, {
        town: {
          id: this.id,
          resources: this.resources,
          buildings: this.buildings,
          loyalty: this.loyalty,
          production: this.production,
          score: this.score,
          updatedAt: this.updatedAt,
        },
        item: item.id,
      }, 'town:buildingCompleted');
      return this;
    } catch (err) {
      await trx.rollback();
      throw err;
    }
  }

  async processUnitQueue(item: UnitQueue) {
    const trx = await transaction.start(knexDb.world);
    const update: Partial<Town> = {
      units: {
        ...this.units,
        [item.name]: {
          inside: this.units[item.name].inside + item.amount,
          queued: this.units[item.name].queued - item.amount,
        },
      },
      resources: this.getResources(item.endsAt),
      updatedAt: +item.endsAt,
    };

    try {
      await item.$query(trx).delete();
      await this.$query<Town>(trx)
        .patch(update)
        .context({ resourcesUpdated: true });
      await trx.commit();

      this.unitQueues = this.unitQueues.filter(({ id }) => id !== item.id);
      TownSocket.emitToTownRoom(this.id, {
        town: {
          id: this.id,
          units: this.units,
          resources: this.resources,
          loyalty: this.loyalty,
          updatedAt: this.updatedAt,
        },
        item: item.id,
      }, 'town:recruitmentCompleted');

      return this;
    } catch (err) {
      await trx.rollback();
      throw err;
    }
  }

  async processMovement(item: Movement) {
    return await MovementResolver.resolveMovement(item, this);
  }

  getAvailablePopulation(): number {
    const supportPop = this.originSupport.reduce((result, { units }) => result + Object.entries(units).reduce((a, b) => a + worldData.unitMap
    [b[0]].farmSpace * b[1], 0), 0);
    const attackPop = this.originMovements.reduce((result, { units }) => result + Object.entries(units).reduce((a, b) => a + worldData.unitMap
    [b[0]].farmSpace * b[1], 0), 0);
    const returnPop = this.targetMovements.reduce((result, { units, type }) =>
      result + type === MovementType.return ? Object.entries(units).reduce((a, b) => a + worldData.unitMap
      [b[0]].farmSpace * b[1], 0) : 0, 0);

    const townPop = worldData.units.reduce((result, unit) => result + Object.values(this.units[unit.name]).reduce((a, b) => a + b) * unit.farmSpace, 0);
    const total = worldData.buildingMap.farm.data[this.buildings.farm.level].population;
    return total - townPop - supportPop - attackPop - returnPop;
  }

  getWallBonus(): number {
    return worldData.buildingMap.wall.data[this.buildings.wall.level].defense || 1;
  }

  getRecruitmentModifier(): number {
    return worldData.buildingMap.barracks.data[this.buildings.barracks.level].recruitment;
  }

  static calculateScore(buildings): number {
    return worldData.buildings.reduce((result, building) => {
      const target = building.data[buildings[building.name].level];
      const score = target ? target.score : 0;
      return result + score;
    }, 0);
  }

  static calculateDistance(originCoords: Coords, targetCoords: Coords) {
    const origin = Town.offsetToCube(originCoords);
    const target = Town.offsetToCube(targetCoords);
    return Math.max(
      Math.abs(origin.x - target.x),
      Math.abs(origin.y - target.y),
      Math.abs(origin.z - target.z),
    );
  }

  static offsetToCube(coords: Coords) {
    const off = 1;
    const x = coords[0] - Math.trunc((coords[1] + off * (coords[1] % 2)) / 2);
    const z = coords[1];
    return {
      x,
      z,
      y: -x - z,
    };
  }

  static getInitialUnits(): Dict<TownUnit> {
    return worldData.units.reduce((result, item) => {
      result[item.name] = { inside: 0, queued: 0 };
      return result;
    }, {});
  }

  static resetInsideUnits(townUnits): Dict<TownUnit> {
    return worldData.units.reduce((result, item) => {
      result[item.name] = { inside: 0, queued: townUnits[item.name].queued || 0 };
      return result;
    }, {});
  }

  static getInitialBuildings(): TownBuildings {
    return worldData.buildings.reduce((result, item) => {
      result[item.name] = { level: item.levels.min, queued: 0 };
      return result;
    }, {});
  }

  $beforeInsert(queryContext) {
    super.$beforeInsert(queryContext);
    this.resources = this.resources || {
      wood: 800,
      clay: 800,
      iron: 800,
    };
    this.production = this.production || this.getProduction();
    this.units = this.units || Town.getInitialUnits();
    this.buildings = this.buildings || Town.getInitialBuildings();
    this.score = this.score || Town.calculateScore(this.buildings);
    this.playerId = this.playerId || null;

    // Set for consistent model values
    this.buildingQueues = [];
    this.unitQueues = [];
    this.originMovements = [];
    this.targetMovements = [];
    this.originSupport = [];
    this.targetSupport = [];
  }

  $beforeValidate(jsonSchema, json, opt) {
    jsonSchema = super.$beforeValidate(jsonSchema, json, opt);
    return {
      ...jsonSchema,
      properties: {
        ...jsonSchema.properties,
        production: {
          type: 'object',
          properties: {
            wood: { type: 'integer' },
            clay: { type: 'integer' },
            iron: { type: 'integer' },
          },
          default: {
            wood: worldData.world.baseProduction,
            clay: worldData.world.baseProduction,
            iron: worldData.world.baseProduction,
          },
        },
        buildings: {
          type: 'object',
          properties: worldData.buildings.reduce((result, item) => {
            result[item.name] = {
              type: 'object',
              properties: {
                level: { type: 'integer' },
                queued: { type: 'integer' },
              },
            };
            return result;
          }, {}),
          default: worldData.buildings.reduce((result, item) => {
            result[item.name] = { level: item.levels.min, queued: 0 };
            return result;
          }, {}),
        },
        units: {
          type: 'object',
          properties: worldData.units.reduce((result, item) => {
            result[item.name] = {
              type: 'object',
              properties: {
                inside: { type: 'integer' },
                queued: { type: 'integer' },
              },
            };
            return result;
          }, {}),
          default: worldData.units.reduce((result, item) => {
            result[item.name] = {
              inside: 0,
              queued: 0,
            };
            return result;
          }, {}),
        },
        score: { type: 'integer' },
      },
    };
  }

  // Keep in mind that patches only have the updated values on this
  // Old property might be missing values as well
  $beforeUpdate(opt, queryContext) {
    if (!opt.old) { return; }
    const date = +(this.updatedAt || Date.now());
    if (!queryContext.resourcesUpdated) {
      this.resources = this.getResources(date, opt.old.updatedAt, opt.old);
    }
    if (!queryContext.loyaltyUpdated) {
      this.loyalty = this.getLoyalty(date, opt.old.updatedAt, opt.old);
    }
    if (queryContext.updateScore) {
      this.score = Town.calculateScore(this.buildings || opt.old.buildngs);
    }
    this.updatedAt = date;
  }

  static jsonSchema = {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      name: { type: 'string', default: 'Abandoned Town' },
      loyalty: { type: 'number', default: 100 },
      // location: { type: 'array' },
      resources: {
        type: 'object',
        properties: {
          wood: { type: 'number' },
          clay: { type: 'number' },
          iron: { type: 'number' },
        },
        default: {
          wood: 800,
          clay: 800,
          iron: 800,
        },
      },
    },
  };

  // TODO: targetMovements shouldn't show units for players but should have units for processing
  // TODO: These relations are fairly complex, consider a different appracoh
  static townRelations = '[buildingQueues, unitQueues, originMovements, targetMovements, originSupport, targetSupport]';
  static townRelationsFiltered = `[
    buildingQueues(orderByEnd),
    unitQueues(orderByEnd),
    originMovements(selectNonReturn, orderByEnd),
    targetMovements(orderByEnd),
    originSupport(orderByCreated),
    targetSupport(orderByCreated),
  ]`;
  static townRelationsFilteredNoMovementUnits = `[
    buildingQueues(orderByEnd),
    unitQueues(orderByEnd),
    originMovements(selectNonReturn, orderByEnd),
    targetMovements(orderByEnd),
    originSupport(orderByCreated),
    targetSupport(orderByCreated),
  ]`;
  static townRelationFilters = {
    orderByEnd: (builder) => builder.orderBy('endsAt', 'asc'),
    orderByCreated: (builder) => builder.orderBy('createdAt', 'desc'),
    selectNonReturn: (builder) => builder.where('type', '!=', MovementType.return),
  };

  static get namedFilters() {
    return {
      selectId: (builder) => builder.select('id'),
      selectTownProfile: (builder) => builder.select('id', 'name', 'location', 'score'),
    };
  }

  static async processTownQueues(item: number | Town, time?: number, processed = []): Promise<ProcessingResult> {
    const queueTime = time || Date.now();
    try {
      const town = typeof item === 'number' ? await getTownWithItems({ id: item }, knexDb.world) : item;

      const queues = [
        ...town.buildingQueues,
        ...town.unitQueues,
        ...town.originMovements,
        ...town.targetMovements,
      ]
        .filter((queue) => +queue.endsAt <= queueTime)
        .sort((a, b) => +a.endsAt - +b.endsAt);

      if (!queues.length) { return { town, processed }; }

      return await town.processQueues(queues, processed);
    } catch (err) {
      logger.error(err, 'errored while processing retrying');
      if (err && err.processed) {
        const townId = typeof item === 'number' ? item : item.id;
        return this.processTownQueues(townId, time, [...processed, ...err.processed]);
      }
    }
  }
}
