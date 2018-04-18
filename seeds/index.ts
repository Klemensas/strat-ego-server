import { transaction } from 'objection';

import * as config from '../src/config/environment';
import { knexDb } from '../src/sqldb';
import { seed as seedMain } from './main/example';
import { seed as seedWorld } from './world/example';
import { seed as seedQueues } from './world/queues';

const speed = config.seed.speed;
const demoUserCount = config.seed.demoUserCount;
const baseProduction = config.seed.baseProduction;
const queueRate = config.seed.queueRate;
const queueCount = config.seed.queueCount;
const queueSpread = config.seed.queueSpread;
const townPercent = config.seed.townPercent;
const townArea = config.seed.townArea;
const townDistance = config.seed.townDistance;
const maxDemoTowns = 5;
const demoTownRate = 0.4;
const seedString = 'megapolis';

(async () => {
  console.log('Seeding in progress, this might take a while, please wait', demoUserCount, queueCount);
  console.time('seed');
  try {
    const mainData = await seedMain(knexDb.main, speed, demoUserCount);
    const users = mainData[0];
    const world = mainData[1][0];

    const worldData = await seedWorld(
      knexDb.world,
      users,
      world,
      maxDemoTowns,
      demoTownRate,
      speed,
      baseProduction,
      townPercent,
      townArea,
      townDistance,
    );
    await seedQueues(knexDb.world, seedString, worldData.towns, queueRate, queueCount, queueSpread);

    console.timeEnd('seed');
    console.log('seeding done');
    process.exit(0);
    return 1;
  } catch (err) {
    console.timeEnd('seed');
    console.log('failed seeding, might need to rollback', err);
    process.exit(1);
  }
})();
