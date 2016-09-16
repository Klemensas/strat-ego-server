import { main, world } from '../../sqldb';
import * as map from '../../components/map';

const UserWorlds = main.UserWorlds;
const Player = world.Player;
const Town = world.Town;

function playerData(world, player, targetPlayer) {
  const isActive = req.user.UserWorlds.some(w => w.World.toLowerCase() === targetWorld);
  if (!isActive) {
    return res.status(401).end();
  }
  return Player.findOne({
    where: {
      UserId: req.user._id,
    },
    include: {
      model: Town,
    },
  })
  .then(handleEntityNotFound(res))
  .then(respondWithResult(res))
  .catch(handleError(res));
}

function joinWorld(targetWorld, name, userId) {
  return map.chooseLocation(targetWorld)
  .then(location => {
    return Player.create({
      name,
      UserId: userId,
      Towns: [{
        name: `${name}s Town`,
        location,
      }],
    }, {
      include: [Town],
    });
  })
  .then(player => {
    return UserWorlds.create({
      UserId: userId,
      World: targetWorld,
      PlayerId: player._id,
    })
    .then(() => player);
  });
}


export const worldCtrl = {
  playerData,
  joinWorld,
};
