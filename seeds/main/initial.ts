import { User } from '../../src/api/user/user';
import { World } from '../../src/api/world/world';

export const seed = (knex, speed = 1, demoUserCount = 100, expansionRate = 172800000, expansionGrowth = 1.1) => Promise.all([
  User.query(knex).del().then(() => {
    const demoUsers = [];
    for (let i = 0; i < demoUserCount; i++) {
      demoUsers.push({
        name: `demo#${i}`,
        email: `user${i}@demo.com`,
        password: 'test',
        role: 'member',
        provider: 'local',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    return User.query(knex).insert([{
      name: 'admin',
      email: 'admin@admin.com',
      password: 'test',
      role: 'admin',
      provider: 'local',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }, {
      name: 'test',
      email: 'test@test.com',
      password: 'test',
      salt: 'AzhSjDA2sFinkcPEOY4ZuA==',
      role: 'member',
      provider: 'local',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ...demoUsers]);
  }),
  World.query(knex).del().then(() => World.query(knex).insert([{
    name: 'megapolis',
    baseProduction: 5000,
    speed,
    size: 999,
    regionSize: 27,
    fillTime: (90 * 24 * 60 * 60 * 1000),
    fillPercent: 0.8,
    barbPercent: 0.6,
    timeQouta: 0.4,
    generationArea: 9,
    currentRing: 1,
    initialLoyalty: 30,
    loyaltyRegeneration: 1,
    loyaltyReductionRange: [100, 105],
    expansionRate,
    expansionGrowth,
    lastExpansion: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    townGrowthInterval: 14400000,
    townLastGrowth: Date.now(),
  }])),
]);
