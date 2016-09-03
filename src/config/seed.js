import sqldb from '../sqldb';

const User = sqldb.main.User;
const Message = sqldb.main.Message;
const World = sqldb.main.World;
const UserWorlds = sqldb.main.UserWorlds;
const Player = sqldb.world.Player;
const Restaurant = sqldb.world.Restaurant;

import * as map from '../components/map';
import { addWorld } from '../components/worlds';

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
    addWorld(world.name.toLowerCase(), world);
  });

// Restaurant.sync().then(() => Restaurant.getAvailableCoords([[497, 500]]));

Player.sync().then(() => Player.destroy({ where: {} }));
UserWorlds.sync().then(() => UserWorlds.destroy({ where: {} }));
Restaurant.sync().then(() => Restaurant.destroy({ where: {} }));
// Restaurant.sync()
//   .then(() => Restaurant.destroy({ where: {} }))
//   // .then(() => Restaurant.bulkCreate([{
//   //   name: 'kebab',
//   //   location: [497, 500],
//   // }]))
//   .then(() => console.log('restaurant?'));

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


function populateMessages(userId) {
console.log('-----pass 5')
  Message.sync()
    .then(() => Message.destroy({ where: {} }))
    .then(() => {
      Message.bulkCreate([{
        UserId: userId,
        content: 'I like kebab'
      }, {
        UserId: null,
        content: 'Hohohoh i am a rogue'
      }])
    })
    .then(() => console.log('finished populating db'))
}

// import Message from '../api/message/message.model';
// import User from '../api/user/user.model';
// import Restaurant from '../api/restaurant/restaurant.model';
// import buildings from './game/buildings';
// import { defaultWorkers } from './game/workers';

// Loop through 100*100 fields generating restaurants at %
// const chance = 0.22;
// const restaurants = [];
// for (let i = 1; i < 100; i++) {
//   for (let j = 1; j < 100; j++) {
//     if (Math.random() <= chance) {
//       restaurants.push({
//         name: `Restaurant #${i * j}`,
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
//   Restaurant.find({}).remove()
//     .then(() => {
//       restaurants.forEach((rest, i) => {
//         Restaurant.create(rest)
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
