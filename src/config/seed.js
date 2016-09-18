import sqldb from '../sqldb';
import config from './environment';

import { buildingData } from './game/buildingData';

import * as map from '../components/map';
import { addWorld } from '../components/worlds';

// Randomize session while seeding to nulify old tokens
config.secrets.session = String(Math.random());


const User = sqldb.main.User;
const Message = sqldb.main.Message;
const World = sqldb.main.World;
const UserWorlds = sqldb.main.UserWorlds;
const Player = sqldb.world.Player;
const Town = sqldb.world.Town;
const Building = sqldb.world.Building;


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
      .then(() => Building.bulkCreate(buildingData))
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

// import Message from '../api/message/message.model';
// import User from '../api/user/user.model';
// import Town from '../api/Town/Town.model';
// import buildings from './game/buildings';
// import { defaultWorkers } from './game/workers';

// Loop through 100*100 fields generating restaurants at %
// const chance = 0.22;
// const restaurants = [];
// for (let i = 1; i < 100; i++) {
//   for (let j = 1; j < 100; j++) {
//     if (Math.random() <= chance) {
//       restaurants.push({
//         name: `Town #${i * j}`,
//         location: [i, j],
//         buildings: buildings.defaultBuildings,
//         workers: defaultWorkers,
//       });
//     }
//   }
// }

// const users = [{
//   provider: 'local',
//   name: 'Test User',
//   email: 'test@test.com',
//   password: 'test',
//   gameData: {
//     active: true,
//     restaurants: null,
//   },
//   role: 'admin',
// }, {
//   provider: 'local',
//   name: 'Admin User',
//   email: 'admin@admin.com',
//   password: 'test',
//   gameData: {
//     active: true,
//     restaurants: null,
//   },
// }];

// // const messages = [{
//   owner: 'Init',
//   content: 'Hello. Nice to see you here.',
// }];
// Message.find({}).remove().then(() => {
//   messages.forEach(m => Message.create(m));
// });

// // let savedRestaurants = [];

// function populateUsers() {
//   users.forEach((user, i) => {
//     const ind = Math.floor(Math.random() * savedRestaurants.length);
//     const rest = savedRestaurants.splice(ind, 1);
//     user.gameData.restaurants = rest;
//     User.create(user)
//       .then(u => {
//         rest[0].owner = u;
//         return rest[0].save().then(() => {
//           if (i === users.length - 1) {
//             console.log('Seeding done.');
//           }
//           return true;
//         });
//       });
//   });
//   return;
// }

// User.find({}).remove().then(() => {
//   Town.find({}).remove()
//     .then(() => {
//       restaurants.forEach((rest, i) => {
//         Town.create(rest)
//           .then(r => {
//             savedRestaurants.push(r);
//             if (i === restaurants.length - 1) {
//               populateUsers();
//             }
//             return true;
//           });
//       });
//       return true;
//     });
//   return true;
// });
