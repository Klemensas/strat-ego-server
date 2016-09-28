import { main, world } from '../../sqldb';
import * as map from '../../components/map';
import { activeWorlds } from '../../components/worlds';

const World = main.World;
const Player = world.Player;
const Restaurant = world.Restaurant;

function respondWithResult(res, statusCode) {
  const code = statusCode || 200;
  return entity => {
    if (entity) {
      res.status(code).json(entity);
    }
  };
}

function handleEntityNotFound(res) {
  return entity => {
    if (!entity || (Array.isArray(entity) && !entity.length)) {
      res.status(404).end();
      return null;
    }
    return entity;
  };
}

function handleError(res, statusCode) {
  const code = statusCode || 500;
  return err => {
    res.status(code).send(err);
  };
}

export function worldData(req, res) {
  const target = req.params.world;
  return World.findOne({
    where: {
      name: target,
    },
  })
    .then(handleEntityNotFound(res))
    .then(respondWithResult(res))
    .catch(handleError(res));
}

export function worlds(req, res) {
  const data = [];
  activeWorlds.forEach(world => {
    data.push(world);
  });
  res.status(200).json(data);
}

export function playerData(req, res) {
  const targetWorld = String(req.params.world).toLowerCase();
  const isActive = req.user.UserWorlds.some(w => w.World.toLowerCase() === targetWorld);
  if (!isActive) {
    return res.status(401).end();
  }
  return Player.findOne({
    where: {
      UserId: req.user._id,
    },
    include: {
      model: Restaurant,
    },
  })
  .then(handleEntityNotFound(res))
  .then(respondWithResult(res))
  .catch(handleError(res));
}
