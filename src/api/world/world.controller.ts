import WorldData from '../../components/world';

function worlds(req, res) {
  const data = [];
  [WorldData].forEach((world) => data.push(world));
  res.status(200).json(data);
}

// function playerData(world, player, targetPlayer) {
//   const isActive = req.user.UserWorlds.some(w => w.World.toLowerCase() === targetWorld);
//   if (!isActive) {
//     return res.status(401).end();
//   }
//   return Player.findOne({
//     where: {
//       UserId: req.user._id,
//     },
//     include: {
//       model: Town,
//     },
//   })
//   .then(handleEntityNotFound(res))
//   .then(respondWithResult(res))
//   .catch(handleError(res));
// }

// function joinWorld(targetWorld, name, userId) {
//   return map.chooseLocation(targetWorld)
//   .then(location => {
//     return Player.create({
//       name,
//       UserId: userId,
//       Towns: [{
//         name: `${name}s Town`,
//         location,
//       }],
//     }, {
//       include: [Town],
//     });
//   })
//   .then(player => {
//     return UserWorlds.create({
//       UserId: userId,
//       World: targetWorld,
//       PlayerId: player._id,
//     })
//     .then(() => player);
//   });
// }

// function worldData(req, res) {
//   const target = req.params.world;
//   return World.findOne({
//     where: {
//       name: target,
//     },
//   })
//     .then(handleEntityNotFound(res))
//     .then(respondWithResult(res))
//     .catch(handleError(res));
// }

// function playerData(req, res) {
//   const targetWorld = String(req.params.world).toLowerCase();
//   const isActive = req.user.UserWorlds.some(w => w.World.toLowerCase() === targetWorld);
//   if (!isActive) {
//     return res.status(401).end();
//   }
//   return Player.findOne({
//     where: {
//       UserId: req.user._id,
//     },
//     include: {
//       model: Restaurant,
//     },
//   })
//   .then(handleEntityNotFound(res))
//   .then(respondWithResult(res))
//   .catch(handleError(res));
// }

export default {
  // playerData,
  // joinWorld,
  worlds,
};
