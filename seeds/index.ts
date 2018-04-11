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
  const mainTrx = await transaction.start(knexDb.main);
  const worldTrx = await transaction.start(knexDb.world);
  try {
    const mainData = await seedMain(mainTrx, speed, demoUserCount);
    const users = mainData[0];
    const world = mainData[1][0];

    await mainTrx.commit();
    const worldData = await seedWorld(worldTrx, users, world, maxDemoTowns, demoTownRate, speed, baseProduction);
    await worldTrx.commit();

    console.timeEnd('seed');
    console.log('seeding done');
    process.exit(0);
    return 1;
  } catch (err) {
    await mainTrx.rollback();
    await worldTrx.rollback();

    console.log(err);
    console.timeEnd('seed');
    console.log('failed seeding');
    process.exit(1);
  }
})();
