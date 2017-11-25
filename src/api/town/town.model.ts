import { Sequelize, Model, DataTypes, BelongsTo, HasMany, HasManyCreateAssociationMixin, Transaction } from 'sequelize';
import * as Bluebird from 'bluebird';

import { io } from '../../';
import WorldData from '../../components/world';
import MapManager from '../../components/map';
import MovementResolver from './components/movement.resolver';
import { TownBuildings, TownUnits } from '../util.model';
import { world } from '../../sqldb';
import { logger } from '../../';

export interface TownUnits {
  outside: number;
  inside: number;
  queued: number;
}

export interface Resources {
  clay?: number;
  wood?: number;
  iron?: number;
}

export type ProcessedQueues = any[];

export interface ProcessedTown {
  town: Town;
  processed: ProcessedQueues;
}

export type Coords = [number, number];

export interface CubeCoords {
  x: number;
  y: number;
  z: number;
}

export type QueueType = 'Movement' | 'UnitQueue' | 'BuildingQueue';

export class Town extends Model {
  static associations: {
    Player: BelongsTo;
    BuildingQueues: HasMany;
    UnitQueues: HasMany;
    MovementOriginTown: HasMany;
    MovementDestinationTown: HasMany;
    ReportDestinationTown: HasMany;
    ReportOriginTown: HasMany;
  };
  static getAvailableCoords: (coords: any[]) => Bluebird<any[]>;
  static offsetToCube: (coords: Coords) => CubeCoords;
  static calculateDistance: (originCoords: Coords, taretCoords: Coords) => number;
  static processTownQueues: (id: number, time?: Date, processed?: ProcessedQueues) =>
    Bluebird<ProcessedTown>;
  static setInitialUnits: () => TownUnits;

  public id: number;
  public name: string;
  public loyalty: number;
  public location: [number, number];
  public production: Resources;
  public resources: Resources;
  public buildings: TownBuildings;
  public units: TownUnits;
  public createdAt: Date;
  public updatedAt: Date;

  // Associations
  public PlayerId: number;
  public Player: Player;
  public BuildingQueues: BuildingQueue[];
  public UnitQueues: UnitQueue[];
  public MovementDestinationTown: Movement[];
  public MovementOriginTown: Movement[];
  public ReportDestinationTown: Report[];
  public ReportOriginTown: Report[];

  public createMovementOriginTown: HasManyCreateAssociationMixin<Movement>;
  public createBuildingQueue: HasManyCreateAssociationMixin<BuildingQueue>;

  public notify(event) {
    return this.reload({ include: townIncludes })
      .then((town) => {
        town.MovementDestinationTown = town.MovementDestinationTown.map((movement) => {
          if (movement.type !== 'attack') {
            delete movement.units;
            delete movement.createdAt;
            delete movement.updatedAt;
          }
          return movement;
        });
        return town;
      })
      .then((town) => {
        io.sockets.in(town.id as any).emit('town', { town, event });
      });
  }

  public updateRes(now, previous = this.updatedAt) {
    const timePast = (now - new Date(previous).getTime()) / 1000 / 60 / 60;
    const maxRes = this.getMaxRes();
    const clay = this.resources.clay + this.production.clay * timePast;
    const wood = this.resources.wood + this.production.wood * timePast;
    const iron = this.resources.iron + this.production.iron * timePast;
    this.resources = {
      clay: Math.min(maxRes, clay),
      wood: Math.min(maxRes, wood),
      iron: Math.min(maxRes, iron),
    };
    return this;
  }

  public getLoyaltyGrowth(now, previous = this.updatedAt) {
    if (this.loyalty === 100) {
      return this;
    }

    const growthPerHour = WorldData.world.loyaltyRegeneration;
    const timePast = (now - new Date(previous).getTime()) / 1000 / 60 / 60;
    const growth = growthPerHour * timePast;
    this.loyalty = Math.min(100, this.loyalty + growth);
    return this;
  }

  public calculateProduction() {
    const buildingData = WorldData.buildingMap;
    return {
      wood: WorldData.world.baseProduction + buildingData.wood.data[this.buildings.wood.level].production,
      clay: WorldData.world.baseProduction + buildingData.clay.data[this.buildings.clay.level].production,
      iron: WorldData.world.baseProduction + buildingData.iron.data[this.buildings.iron.level].production,
    };
  }

  public getLastQueue(queue) {
    return this[queue].sort((a, b) => b.endsAt.getTime() - a.endsAt.getTime())[0];
  }

  public checkBuildingRequirements(requirements) {
    return requirements ?
    requirements.every(({ item, level }) => this.buildings[item].level >= level) :
    true;
  }

  public getMaxRes() {
    return WorldData.buildingMap.storage.data[this.buildings.storage.level].storage;
  }

  public getWallBonus() {
    return WorldData.buildingMap.wall.data[this.buildings.wall.level].defense || 1;
  }

  public getRecruitmentModifier() {
    return WorldData.buildingMap.barracks.data[this.buildings.barracks.level].recruitment;
  }

  public getAvailablePopulation() {
    const used = WorldData.units.reduce((t, unit) => {
      return t + Object.values(this.units[unit.name]).reduce((a, b) => a + b);
    }, 0);
    const total = WorldData.buildingMap.farm.data[this.buildings.farm.level].population;
    return total - used;
  }

  public process(
    queues,
    processed = [],
    resolvePromise?,
    rejectPromise?,
  ): Promise<{ town: Town, processed: ProcessedQueues }> {
    if (!resolvePromise) {
      return new Promise((resolve, reject) => this.process(queues, processed, resolve, reject));
    }
    if (!queues.length) {
      return resolvePromise({ town: this, processed });
    }

    const item = queues.shift();
    const queueType: QueueType = item.constructor.name;
    return this[`process${queueType}`](item)
      .then((town: Town) => town.process(queues, [ ...processed, item ], resolvePromise, rejectPromise))
      .catch((error) => rejectPromise({ error, processed }));
  }

  public processUnitQueue(item: UnitQueue) {
    const town = this;
    town.units[item.unit].inside += item.amount;
    town.units[item.unit].queued -= item.amount;
    town.changed('units', true);
    return world.sequelize.transaction((transaction) => item.destroy({ transaction})
      .then(() => town.save({ transaction })));
  }

  public processBuildingQueue(item: BuildingQueue) {
    const town = this;
    const building = town.buildings[item.building];
    building.level++;
    if (building.queued === building.level) {
      building.queued = 0;
    }
    town.changed('buildings', true);
    return world.sequelize.transaction((transaction) => item.destroy({ transaction })
      .then(() => town.save({ transaction })));
  }

  public processMovement(item: Movement) {
    return MovementResolver.resolveMovement(item, this);
  }
}

Town.init({
  id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    validate: {
      notEmpty: true,
      len: [1, 50],
    },
    defaultValue: 'Abandoned Town',
  },
  loyalty: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 100,
  },
  location: {
    type: DataTypes.ARRAY(DataTypes.INTEGER),
    allowNull: false,
    unique: true,
  },
  production: {
    type: DataTypes.JSON,
  },
  resources: {
    type: DataTypes.JSON,
    validate: {
      isPositive(resources) {
        const invalid = Object.keys(resources).some((i) => resources[i] < 0);
        if (invalid) {
          throw new Error(`Resources can't be negative. Last updated at ${this.updatedAt}`);
        }
      },
    },
  },
  buildings: {
    type: DataTypes.JSONB,
  },
  units: {
    type: DataTypes.JSONB,
    validate: {
      isPositive(units) {
        const invalid = Object.keys(units).some((i) => units[i].inside < 0 || units[i].outside < 0);
        if (invalid) {
          throw new Error(`Units can't be negative. Last updated at ${this.updatedAt}`);
        }
      },
    },
  },
}, { sequelize: world.sequelize });

Town.beforeBulkCreate((towns: Town[]) => {
  const buildings = WorldData.buildings.reduce((map, item) => {
    map[item.name] = { level: item.levels.min, queued: 0 };
    return map;
  }, {});
  const units = Town.setInitialUnits();
  const resources = {
    wood: 800,
    clay: 800,
    iron: 800,
  };
  return towns.map((town: Town) => {
    town.buildings = buildings;
    town.units = units;
    town.resources = resources;
    town.production = town.calculateProduction();
    return town;
  });
});
Town.beforeCreate((town: Town) => {
  const buildings = WorldData.buildings.reduce((map, item) => {
    map[item.name] = { level: item.levels.min, queued: 0 };
    return map;
  }, {});
  const units = Town.setInitialUnits();

  // Town.resources
  town.resources = {
    wood: 800,
    clay: 800,
    iron: 800,
  };
  town.buildings = buildings;
  town.production = town.calculateProduction();
  town.units = units;
});
// Town.beforeValidate((town: Town, {}) => {
Town.beforeUpdate((town: Town, {}) => {
  if (town.isNewRecord) {
    return;
  }
  // Update res if not marked as changed
  if (!town.changed('resources')) {
    town.updateRes(town.updatedAt, town.previous('updatedAt'));
  }
  // Recalculate production if buildings updated
  if (town.changed('buildings')) {
    town.production = town.calculateProduction();
  }

  if (!town.changed('loyalty') && town.loyalty !== 100) {
    town.getLoyaltyGrowth(town.updatedAt, town.previous('updatedAt'));
  }
});
// Town.beforeUpdate((town: Town) => {
//   logger.info('before update', town, town.production);
// });
// afterUpdate: town => {
//   town.getBuildingQueues()
//     .then(queues => {
//       town.setDataValue('BuildingQueues', queues);
//       logger.info(`Town ${town.id} updated, sending data to sockets`);
//     });
// },
Town.afterCreate((town: Town) => {
  town.reload({ include: [{ all: true }] })
    .then((fullTown) => MapManager.addTown(fullTown));
});

Town.setInitialUnits = () => {
  return WorldData.units.reduce((map, item) => {
    map[item.name] = { inside: 0, outside: 0, queued: 0 };
    return map;
  }, {});
};

Town.getAvailableCoords = (allCoords) => {
  return Town.findAll({
    attributes: ['location'],
    where: {
      location: {
        $in: [...allCoords],
      },
    },
    raw: true,
  })
  .then((towns: Town[]) => {
    const usedLocations = towns.map((i) => i.location.join(','));
    return allCoords.filter((c) => !usedLocations.includes(c.join(',')));
  });
};

Town.offsetToCube = (coords) => {
  const off = 1;
  const x = coords[0] - Math.trunc((coords[1] + off * (coords[1] % 2)) / 2);
  const z = coords[1];
  return {
    x,
    z,
    y: -x - z,
  };
};

Town.calculateDistance = (originCoords, targetCoords) => {
  const origin = Town.offsetToCube(originCoords);
  const target = Town.offsetToCube(targetCoords);
  return Math.max(
    Math.abs(origin.x - target.x),
    Math.abs(origin.y - target.y),
    Math.abs(origin.z - target.z),
  );
};

Town.processTownQueues = (id: number, time?: Date, processed = []) => {
  const queueTime = time || new Date();
  return Town.findById(id, {
    include: [{
      model: BuildingQueue,
      as: 'BuildingQueues',
      where: { endsAt: { $lt: queueTime } },
      required: false,
    }, {
      model: UnitQueue,
      as: 'UnitQueues',
      where: { endsAt: { $lt: queueTime } },
      required: false,
    }, {
      model: Movement,
      as: 'MovementOriginTown',
      where: { endsAt: { $lt: queueTime } },
      required: false,
    }, {
      model: Movement,
      as: 'MovementDestinationTown',
      where: { endsAt: { $lt: queueTime } },
      required: false,
    }],
  })
  .then((town) => {
    const queues = [
      ...town.BuildingQueues,
      ...town.UnitQueues,
      ...town.MovementDestinationTown,
      ...town.MovementOriginTown,
    ]
    .sort((a, b) => a.endsAt.getTime() - b.endsAt.getTime());

    if (!queues.length) {
      return { town, processed };
    }
    return town.process(queues, processed)
      .catch(({ error, processedQueues }) => {
        logger.error(error, processedQueues);
        if (error.constructor.name === 'OptimisticLockingError') {
          return Town.processTownQueues(id, time, [ ...processed, ...processedQueues]);
        }
      });
  });
};

import { Player } from '../world/Player.model';
import { Report } from '../report/Report.model';
import { Movement } from './Movement.model';
import { BuildingQueue } from '../world/BuildingQueue.model';
import { UnitQueue } from '../world/UnitQueue.model';

export const townIncludes = [{
  model: Movement,
  as: 'MovementDestinationTown',
  include: [{
    model: Town,
    as: 'MovementOriginTown',
    attributes: ['id', 'name', 'location'],
  }, {
    model: Town,
    as: 'MovementDestinationTown',
    attributes: ['id', 'name', 'location'],
  }],
}, {
  model: Movement,
  as: 'MovementOriginTown',
  include: [{
    model: Town,
    as: 'MovementOriginTown',
    attributes: ['id', 'name', 'location'],
  }, {
    model: Town,
    as: 'MovementDestinationTown',
    attributes: ['id', 'name', 'location'],
  }],
}, {
  model: BuildingQueue,
  as: 'BuildingQueues',
}, {
  model: UnitQueue,
  as: 'UnitQueues',
}];
