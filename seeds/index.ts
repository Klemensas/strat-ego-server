import { seed as seedMain } from './main/example';
import { seed as seedWorld } from './world/example';
import { knexDb } from '../src/sqldb';
import { transaction } from 'objection';

const speed = +(process.env.WORLD_SPEED || 1);
const demoUserCount = +(process.env.DEMO_USERS || 100);
const baseProduction = +(process.env.BASE_PRODUCTION || 5000);
const maxDemoTowns = 5;
const demoTownRate = 0.4;

(async () => {
  console.time('seed');
  try {
    const mainData = await seedMain(knexDb.main, speed, demoUserCount);
    const users = mainData[0];
    const world = mainData[1][0];

    const worldData = await seedWorld(knexDb.world, users, world, maxDemoTowns, demoTownRate, speed, baseProduction);

    console.timeEnd('seed');
    console.log('seeding done');
    process.exit(0);
    return 1;
  } catch (err) {
    console.log(err);
    console.timeEnd('seed');
    console.log('failed seeding');
    process.exit(1);
  }
})();
