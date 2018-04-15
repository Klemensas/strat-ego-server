import { transaction } from 'objection';
import { MovementType } from 'strat-ego-common';

import * as seedrandom from 'seedrandom';

import { Town } from '../../src/api/town/town';
import { Movement } from '../../src/api/town/movement';
import { BuildingQueue } from '../../src/api/building/buildingQueue';
import { UnitQueue } from '../../src/api/unit/unitQueue';
import { QueueItem } from '../../src/api/townQueue';
import { worldData } from '../../src/api/world/worldData';

const maxUnits = 100;

export const seed = async (knex, seedString: string, towns: Town[], queueRate: number, queueCount: number, queueSpread: number) => {
  const rng = seedrandom(seedString);
  const queueTypes = ['movement', 'building', 'unit'];
  const trx = await transaction.start(knex);
  try {
    const time = Date.now();
    // Note: this seeds to abandoned towns as well. Such towns normally shouldn't have queues.
    towns = towns.map((town) => {
      for (let i = 0; i < queueCount; i++) {
        if (rng.quick() > queueRate) { continue; }

        const index = Math.floor(rng.quick() * (queueTypes.length));
        const queueType = queueTypes[index];
        const queueTime = Math.round(time + (queueSpread * (i / queueCount)));
        town = generateQueueItem(town, queueTime, queueType);
      }
      return town;
    });
    await Town.query(knex).upsertGraph(towns);
    await trx.commit();
    return towns;
  } catch (err) {
    await trx.rollback();
    throw err;
  }

  function generateQueueItem(town: Town, queueTime: number, queueType = queueTypes[0]) {
    // Ignore all requirements for simplicity sake
    switch (queueType) {
      case 'building': {
        const target = worldData.buildings[Math.floor(rng.quick() * (worldData.buildings.length - 1 ))];
        const townBuilding = town.buildings[target.name];
        const currentLevel = townBuilding.queued || townBuilding.level;
        // If max level switch to movement
        if (currentLevel >= target.levels.max) { return generateQueueItem(town, queueTime); }
        const buildTime = target.data[townBuilding.queued].buildTime;

        townBuilding.queued = currentLevel + 1;
        town.buildingQueues.push({
          buildTime,
          name: target.name,
          level: townBuilding.queued,
          endsAt: queueTime + buildTime,
        });
        break;
      }
      case 'unit': {
        const target = worldData.units[Math.floor(rng.quick() * (worldData.units.length))];
        const townUnit = town.units[target.name];
        const amount = Math.floor(rng.quick() * (maxUnits)) + 1;
        const recruitTime = target.recruitTime * amount;
        townUnit.queued += amount;
        town.unitQueues.push({
          amount,
          recruitTime,
          name: target.name,
          endsAt: queueTime + recruitTime,
        });
        break;
      }
      case 'movement': {
        const targetTown = towns[Math.floor(rng.quick() * (towns.length - 1))];
        if (targetTown.id === town.id) { return generateQueueItem(town, queueTime, queueType); }
        const target = worldData.units[Math.floor(rng.quick() * (worldData.units.length - 1 ))];
        const townUnit = town.units[target.name];
        const amount = Math.floor(rng.quick() * (maxUnits)) + 1;
        const distance = Town.calculateDistance(town.location, targetTown.location);
        const movementTime = target.speed * distance;

        townUnit.outside += amount;
        town.originMovements.push({
          targetTownId: targetTown.id,
          units: { [target.name]: amount },
          type: MovementType.attack,
          endsAt: queueTime + movementTime,
        });

        break;
      }
    }
    return town;
  }
};
