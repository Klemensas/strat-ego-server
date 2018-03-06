import { main, world } from './index';
import buildingData from '../config/game/buildingData';
import unitData from '../config/game/unitData';
import MapManager from '../components/map';
import { worldData } from '../api/world/worldData';

import { User } from '../api/world/user.model';
import { World } from '../api/world/world.model';
import { UserWorld } from '../api/world/userWorld.model';
import { Player } from '../api/world/player.model';
import { Town } from '../api/town/town.model';
import { Building } from '../api/world/building.model';
import { Unit } from '../api/world/unit.model';
import { Movement } from '../api/town/movement.model';
import { Report } from '../api/report/report.model';
import { Alliance } from '../api/alliance/alliance.model';

export default () => {
  const worldDataService = {
    name: 'Megapolis',
    baseProduction: 5000,
    speed: 100,
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
    furthestRing: worldDataService.generationArea,
    area: worldDataService.generationArea,
    size: Math.ceil(worldDataService.size / 2),
  };

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
    Alliance.sync().then(() => Alliance.destroy({ where: {} })),
    World.sync().then(() => World.destroy({ where: {} })),
    Building.sync().then(() => Building.destroy({ where: {} })),
    Unit.sync().then(() => Unit.destroy({ where: {} })),
    Player.sync().then(() => Player.destroy({ where: {} })),
    UserWorld.sync().then(() => UserWorld.destroy({ where: {} })),
    Town.sync().then(() => Town.destroy({ where: {} })),
    User.sync().then(() => User.destroy({ where: {} })),
    Movement.sync().then(() => Movement.destroy({ where: {} })),
    Report.sync().then(() => Report.destroy({ where: {} })),
  ])
  .then(() => Promise.all([
    World.create(worldDataService),
    User.bulkCreate(userData),
    Building.bulkCreate(buildingData(worldDataService.speed)),
    Unit.bulkCreate(unitData(worldDataService.speed)),
  ]))
  .then(() => worldData.readWorld('Megapolis'))
  .then(() => Town.bulkCreate(seedTowns(
    MapManager.getCoordsInRange(
      townGenerationData.area,
      townGenerationData.furthestRing,
      townGenerationData.size,
    ),
    townGenerationData.percent)))
  .then(() => Town.findAll({ include: [{ all: true }] }))
  .then((towns) => MapManager.addTown(...towns))
  .then(() => console.log('Seeding done.'))
  .catch((error) => console.log('Seeding error', error));
};
