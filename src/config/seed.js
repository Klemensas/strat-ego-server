import { main, world } from '../sqldb';
import config from './environment';

import { buildingData } from './game/buildingData';

import * as map from '../components/map';
import { addWorld } from '../components/worlds';

// Randomize session while seeding to nulify old tokens
config.secrets.session = String(Math.random());


const User = main.User;
const Message = main.Message;
const World = main.World;
const UserWorlds = main.UserWorlds;
const Player = world.Player;
const Town = world.Town;
const Building = world.Building;


World.sync()
  .then(() => World.destroy({ where: {} }))
  .then(() => World.create({
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
  }))
  .then(world => {
    Building.sync()
      .then(() => Building.destroy({ where: {} }))
      .then(() => Building.bulkCreate(buildingData()))
      .then(() => Building.findAll())
      .then(builds => {
        const data = world.dataValues;
        data.buildingData = builds;
        addWorld(data.name.toLowerCase(), data);
      });
  });



Player.sync().then(() => Player.destroy({ where: {} }));
UserWorlds.sync().then(() => UserWorlds.destroy({ where: {} }));
Town.sync().then(() => Town.destroy({ where: {} }));
// Town.sync()
//   .then(() => Town.destroy({ where: {} }))
//   // .then(() => Town.bulkCreate([{
//   //   name: 'kebab',
//   //   location: [497, 500],
//   // }]))
//   .then(() => console.log('Town?'));

User.sync()
  .then(() => User.destroy({ where: {} }))
  .then(() => User.bulkCreate([{
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
  }]))
  .then(() => User.findAll())
  .then(us => {
    us.forEach(u => {
      // Player.create({ UserId: u._id, name: u.name })
      //   .then(player => {
      //     UserWorlds.create({
      //       UserId: u._id,
      //       PlayerId: player._id,
      //       World: 'Megapolis',
      //     });
      //   });
    });
  })
  .then(() => {
    console.log('seeding done');
  });
