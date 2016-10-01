import { main, world } from '../sqldb';
import config from './environment';

import { buildingData } from './game/buildingData';
import { unitData } from './game/unitData';

// import * as map from '../components/map';
import { addWorld } from '../components/worlds';

// Randomize session while seeding to nulify old tokens
config.secrets.session = String(Math.random());

const User = main.User;
// const Message = main.Message;
const World = main.World;
const UserWorlds = main.UserWorlds;
const Player = world.Player;
const Town = world.Town;
const Building = world.Building;
const Unit = world.Unit;

let worldInstance;
const worldData = {
  name: 'Megapolis',
  baseProduction: 5,
  moneyConversion: 0.5,
  speed: 1,
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

Promise.all([
  World.sync().then(() => World.destroy({ where: {} })),
  Building.sync().then(() => Building.destroy({ where: {} })),
  Unit.sync().then(() => Unit.destroy({ where: {} })),
  Player.sync().then(() => Player.destroy({ where: {} })),
  UserWorlds.sync().then(() => UserWorlds.destroy({ where: {} })),
  Town.sync().then(() => Town.destroy({ where: {} })),
  User.sync().then(() => User.destroy({ where: {} })),
])
.then(() => Promise.all([
  World.create(worldData),
  User.bulkCreate(userData),
]))
.then(data => {
  worldInstance = data[0].dataValues;
  return Promise.all([
    Building.bulkCreate(buildingData()).then(() => Building.findAll({ raw: true })),
    Unit.bulkCreate(unitData).then(() => Unit.findAll({ raw: true })),
    // User.findAll(),
  ]);
})
.then(data => {
  const buildings = data[0];
  worldInstance.buildingData = buildings;
  worldInstance.buildingDataMap = buildings.reduce((map, item) => {
    map[item.name] = item;
    return map;
  }, {});
  addWorld(worldInstance.name.toLowerCase(), worldInstance);
  // const users = data[1];
})
.then(() => console.log('Seeding done.'))
.catch(error => console.log(`Seeding error: ${error}`));
