// import Restaurant from '../api/restaurant/restaurant.model';
// import buildings from '../config/game/buildings';
// import workers from '../config/game/workers';
// import Promise from 'bluebird';
// import { sendRestaurantUpdate } from '../api/restaurant/restaurant.controller';


// function findSoonest(events) {
//   let soonest = 0;
//   soonest = events.building.length ? events.building[0].ends : soonest;
//   soonest = events.unit.length && events.unit[0].ends < soonest ? events.unit[0].ends : soonest;
//   // soonest = events.movement.length && events.movement[0].ends < soonest ? events.unit[0].ends : soonest;
//   return soonest;
// }

// function queuedBuildings(buildings) {
//   const queuedLevels = {};
//   for (const build of buildings) {
//     queuedLevels[build.target] = queuedLevels[build.target] + 1 || 1;
//   }
//   return queuedLevels;
// }

// function checkQueueAndUpdate(rest) {
//   return Promise.try(() => {
//     const time = Date.now();
//     if (rest.events.soonest > time) {
//       return rest;
//     }
//     // TODO: dry this mess up
//     const endedBuildings = [];
//     for (let i = 0; i < rest.events.building.length; i++) {
//       const item = rest.events.building[i];
//       if (item.ends > time) {
//         break;
//       }
//       endedBuildings.push(item);
//       rest.events.building.splice(i, 1);
//       i--;
//     }
//     const endedUnits = [];
//     for (let i = 0; i < rest.events.unit.length; i++) {
//       const item = rest.events.unit[i];
//       if (item.ends > time) {
//         break;
//       }
//       endedUnits.push(item);
//       rest.events.unit.splice(i, 1);
//       i--;
//     }
//     const endedMovements = [];
//     for (let i = 0; i < rest.events.movement.length; i++) {
//       const item = rest.events.movement[i];
//       if (item.ends > time) {
//         break;
//       }
//       endedMovements.push(item);
//       rest.events.movement.splice(i, 1);
//       i--;
//     }
//     updateBuildings(rest, endedBuildings);
//     updateUnits(rest, endedUnits);
//     return updateMovements(rest, endedMovements, time)
//       .then(rest => {
//         rest.events.soonest = findSoonest(rest.events);
//         return rest;
//       });
//   });
// }

// function updateBuildings(rest, targets) {
//   targets.forEach(e => {
//     const building = rest.buildings.find(b => b.title === e.target);
//     building.level++;
//   });
//   return rest;
// }
// function updateUnits(rest, targets) {
//   targets.forEach(e => {
//     const unit = rest.workers.kitchen.find(w => w.title === e.target) || rest.workers.outside.find(w => w.title === e.target);
//     unit.count += (e.amount - e.produced);
//   });
//   return rest;
// }

// function updateMovements(rest, targets) {
//   return Promise.try(() => {
//     if (!targets.length) {
//       return rest;
//     }
//     return Promise.reduce(targets, (result, e) => {
//       switch (e.action) {
//         case 'attack':
//           return commenceAttack(result, e)
//           .then(outcome => {
//             result = outcome;
//             return result;
//           });
//         break;
//         case 'support':
//         console.log('nu uh');
//         break;
//         case 'returning':
//           result = addReturned(result, e);
//           return result;
//         break;
//       }
//     }, rest);
//   });
// }

// function commenceAttack(origin, event) {
//   return Restaurant.findById(event.targetId)
//     .then(target => {
//       const eventUnits = Object.keys(event.units);
//       const totalAttack = eventUnits.reduce((p, c) => {
//         return p += workers.outsideWorkers[c].combat.attack * event.units[c];
//       }, 0);
//       const totalDefense = target.workers.outside.reduce((p, c) => {
//         return p += workers.outsideWorkers[c.title].combat.defense * (c.count - c.moving);
//       }, 0);

//       const defenseLeft = totalDefense - totalAttack;
//       const defPercent = (defenseLeft / totalDefense) * 100;
//       const attackLeft = totalAttack - totalDefense;
//       const attPercent = (attackLeft - totalAttack) * 100;

//       let outcome = {
//         winner: null,
//         oneSided: false,
//       };
//       if (defPercent > 99) { // defense win, no loss for defender
//         origin.workers.outside = origin.workers.outside.map(w => {
//           w.count -= event.units[w.title];
//           w.moving -= event.units[w.title];
//           return w;
//         });
//         outcome.winner = 'defense';
//         outcome.oneSided = true;
//       } else if (defPercent < -9000) { // attack win, no loss for attacker - when more than 10x
//         target.workers.outside = target.workers.outside.map(w => {
//           w.count = 0 + w.moving;
//           return w;
//         });
//         outcome.winner = 'attack';
//         outcome.oneSided = true;
//       } else if (defPercent > 0) { // defense win with losses
//         origin.workers.outside = origin.workers.outside.map(w => {
//           w.count -= event.units[w.title];
//           w.moving -= event.units[w.title];
//           return w;
//         });
//         target.workers.outside = target.workers.outside.map(w => {
//           const lost = Math.floor((w.count - w.moving) * ((100 - defPercent) / 100));
//           w.count -= lost;
//           return w;
//         });
//         outcome.winner = 'defense';
//       } else { // attack win, with losses
//         target.workers.outside = target.workers.outside.map(w => {
//           w.count = 0 + w.moving;
//           return w;
//         });
//         origin.workers.outside = origin.workers.outside.map(w => {
//           const lost = Math.floor(event.units[w.title] * ((100 - attPercent) / 100));
//           event.units[w.title] -= lost;
//           w.count -= lost;
//           w.moving -= lost;
//           return w;
//         });
//         outcome.winner = 'attack';
//       }

//       let result = null;
//       switch (outcome.winner) {
//         case 'attack':
//           // Update event - troops returning
//           console.log(event.queued, event.ends);
//           result = {
//             action: 'returning',
//             units: event.units,
//             ends: event.ends.getTime() + (event.ends - event.queued),
//             queued: event.queued,
//             target: event.target,
//             targetId: event.targetId,
//           };
//           updateDefender(target);
//           break;
//         case 'defense':
//           if (!outcome.oneSided) {
//             updateDefender(target);
//           }
//           break;
//       }

//       if (result) {
//         origin.events.movement.push(result);
//       }
//       console.log(outcome.winner, outcome.oneSided, result)
//       return origin;
//     });
// }

// function addReturned(rest, event) {
//   // console.log(rest, event.units);
//   rest.workers.outside = rest.workers.outside.map(w => {
//     // console.log(w);
//     const target = event.units[w.title];
//     // console.log(target);
//     if (target) {
//       w.moving -= target;
//     }
//     return w;
//   });
//   return rest;
// }

// function updateDefender(target) {
//   return target.save().then(t => {
//     console.log('target update');
//     console.log('-------------');
//     sendRestaurantUpdate(t._id, t);
//     // send event to target
//   });
// }


// function lastItemEnds(queue) {
//   const item = queue[queue.length - 1];
//   if (!item) {
//     return 0;
//   }
//   return item.ends.getTime();
// }

// function queueBuilding(rest, building, level) {
//   const time = Date.now();
//   const buildTime = buildings.buildTimes[building.title][level] * 1000;
//   const ends = (lastItemEnds(rest.events.building) || time) + buildTime;
//   rest.events.building.push({
//     type: 'build',
//     target: building.title,
//     queued: time,
//     ends,
//   });
//   rest.events.soonest = findSoonest(rest.events);
//   return rest;
// }

// function queueRecruits(rest, recruits, filteredUnits) {
//   // Sort necessary if queueing multiple units and we'd like to queue in a non default order
//   const targets = filteredUnits.sort((a, b) => workers.workerTypes.indexOf(a) - workers.workerTypes.indexOf(b));
//   const time = Date.now();
//   targets.forEach(t => {
//     const unit = workers.allWorkers[t];
//     const buildTime = unit.buildTime * recruits[t] * 1000;
//     const ends = (lastItemEnds(rest.events.unit) || time) + buildTime;
//     rest.events.unit.push({
//       target: t,
//       queued: time,
//       amount: recruits[t],
//       produced: 0,
//       ends,
//     });
//   });
//   rest.events.soonest = findSoonest(rest.events);
//   return rest;
// }

// function queueMovement(rest, units, action, target, targetId) {
//   const time = Date.now();
//   const unitTypes = Object.keys(units);
//   let slowest = 0;
//   for (const worker of rest.workers.outside) {
//     const i = unitTypes.indexOf(worker.title);
//     if (i !== -1) {
//       const targetUnit = units[unitTypes[i]];
//       worker.moving = worker.moving + targetUnit || targetUnit;
//       slowest = workers.outsideWorkers[worker.title].speed > slowest ? workers.outsideWorkers[worker.title].speed : slowest;
//     }
//   }
//   const travelTime = calculateTravelTime(findDistance(target, rest.location), slowest);
//   const ends = time + travelTime;
//   rest.events.movement.push({
//     action,
//     targetId,
//     target,
//     units,
//     ends,
//     queued: time,
//   });
//   rest.events.soonest = findSoonest(rest.events);
//   return {
//     rest,
//     event: {
//       action,
//       ends,
//       originId: rest._id,
//       location: rest.location,
//       queued: time,
//     },
//   };
// }

// function findDistance(target, origin) {
//   return +(Math.sqrt(origin.reduce((p, c, i) => p += Math.pow(c - target[i], 2), 0)).toFixed(3));
// }

// function calculateTravelTime(distance, slowest) {
//   return slowest * distance * 60 * 1000;
// }

// let updatingQueue = false;
// function moveQueues() {
//   if (!updatingQueue) {
//     let updatedItems = 0;
//     updatingQueue = true;
//     const currentTime = new Date();
//     const stream = Restaurant.find({ 'events.soonest': { $lte: currentTime } }).stream();
//     stream.on('data', (res) => {
//       stream.pause();
//       checkQueueAndUpdate(res)
//         .then(rest => {
//           Restaurant.update({ _id: res._id, nonce: res.nonce }, res).then(() => stream.resume());
//           updatedItems++;
//         });
//     })
//     .on('error', (e) => {
//       console.log('ERROR ERROR', e);
//     })
//     .on('close', () => {
//       console.log(`${currentTime}, queue updated successfully, items affected #${updatedItems}`);
//       updatingQueue = false;
//     });
//   }
//   setTimeout(moveQueues, 5000 * 60);
// }

// console.log('I am killer')
// // moveQueues();

// export default {
//   queueBuilding,
//   queuedBuildings,
//   queueMovement,
//   queueRecruits,
//   checkQueueAndUpdate,
// };
