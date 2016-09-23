import { world } from '../../sqldb';

const Town = world.Town;
const BuildingQueue = world.BuildingQueue;

function processItem(item) {
  Town.find({ where: { _id: item.TownId } })
    .then(town => {

    })
}

function queueItem(item) {
  const timeLeft = new Date(item.endsAt) - Date.now();
  setTimeout(processItem, timeLeft, item);
}


BuildingQueue
  .destroy({ where: { TownId: 2 } })
  .then(() => BuildingQueue.findAll())
  .then(items => items.forEach(queueItem));

//
// function timeout(i) {
//   User.findOne({ where: { role: 'admin' } }).then(user => {
//     user.name = String(Math.random());
//     return user;
//   })
//   .then(user => user.save())
//   .then(() => console.log(i));
// }
//
// setTimeout(() => {
//   for (let i = 0; i < 1000; i++) {
//     const z = Math.floor(Math.random() * 10);
//     setTimeout(timeout, 1000 * z, i);
//     }
//   console.log('--------- done registering')
// }, 120000);
