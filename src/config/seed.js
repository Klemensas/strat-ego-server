import { main, world } from '../sqldb';
import buildingData from './game/buildingData';
import unitData from './game/unitData';
import { readWorld } from '../components/worlds';
import * as mapUtils from '../components/map';

export default () => {
  const User = main.User;
  const World = main.World;
  const UserWorlds = main.UserWorlds;
  const Player = world.Player;
  const Town = world.Town;
  const Building = world.Building;
  const Unit = world.Unit;
  const Movement = world.Movement;
  const Report = world.Report;
  const worldData = {
    name: 'Megapolis',
    baseProduction: 500,
    speed: 10,
    size: 999,
    regionSize: 27,
    fillTime: (90 * 24 * 60 * 60 * 1000),
    fillPercent: 0.8,
    barbPercent: 0.6,
    timeQouta: 0.4,
    generationArea: 9,
    currentRing: 1,
  };
  const userData = [
    {
      provider: 'local',
      name: 'Test User',
      email: 'test@test.com',
      password: 'test',
    }, {
      provider: 'local',
      role: 'admin',
      name: 'Admin',
      email: 'admin@admin.com',
      password: 'test',
    },
  ];
  const townGenerationData = {
    percent: 0.5,
    furthestRing: worldData.generationArea,
    area: worldData.generationArea,
    size: Math.ceil(worldData.size / 2),
  };
  let generatedWorld = {};

  function seedTowns(coords, factor) {
    console.log(`seeding towns in ${coords.length} fields at ${factor} factor`);
    return coords.reduce((towns, value) => {
      if (Math.random() > factor) {
        return towns;
      }
      towns.push({ location: value });
      return towns;
    }, []);
  }

  return Promise.all([
    World.sync().then(() => World.destroy({ where: {} })),
    Building.sync().then(() => Building.destroy({ where: {} })),
    Unit.sync().then(() => Unit.destroy({ where: {} })),
    Player.sync().then(() => Player.destroy({ where: {} })),
    UserWorlds.sync().then(() => UserWorlds.destroy({ where: {} })),
    Town.sync().then(() => Town.destroy({ where: {} })),
    User.sync().then(() => User.destroy({ where: {} })),
    Movement.sync().then(() => Movement.destroy({ where: {} })),
    Report.sync().then(() => Report.destroy({ where: {} })),
  ])
  .then(() => Promise.all([
    World.create(worldData),
    User.bulkCreate(userData),
  ]))
  .then(() =>
    Promise.all([
      readWorld(worldData.name),
      Building.bulkCreate(buildingData(worldData.speed))
        .then(() => Building.findAll({ raw: true })),
      Unit.bulkCreate(unitData(worldData.speed))
        .then(() => Unit.findAll({ raw: true })),
    ])
  )
  .then(data => {
    generatedWorld = data[0];
  })
  .then(() => Town.bulkCreate(seedTowns(
      mapUtils.getCoordsInRange(townGenerationData.area,
        townGenerationData.furthestRing, townGenerationData.size),
      townGenerationData.percent)))
  .then(() => console.log('Seeding done.'))
  .then(() => generatedWorld)
  .catch(error => console.log('Seeding error', error));
};

// const buildings = ['headquarters', 'barracks', 'wood', 'clay', 'iron', 'wall', 'storage', 'farm'];
// return readWorld('Megapolis')
//   .then(() => Town.findAll())
//   .then(towns => {
//     console.time('special Seed');
//     return Promise.all(
//       towns.map(town => {
//         return Promise.all([
//           town.createBuildingQueue({ building: buildings[Math.ceil(Math.random() * buildings.length) - 1], buildTime: 2, level: 0, endsAt: Date.now() - Math.random() * 100 * 1000 - 5000 }),
//           town.createBuildingQueue({ building: buildings[Math.ceil(Math.random() * buildings.length) - 1], buildTime: 2, level: 0, endsAt: Date.now() - Math.random() * 100 * 1000 - 5000 }),
//           town.createBuildingQueue({ building: buildings[Math.ceil(Math.random() * buildings.length) - 1], buildTime: 2, level: 0, endsAt: Date.now() - Math.random() * 100 * 1000 - 5000 })
//         ]).catch(err => console.log('queue creaete err', err));
//       })
//     ).catch(err => console.log('all err', err));
//   })
//   .then(() => console.timeEnd('special Seed'))
//   .catch(err => console.log('full err', err));
