import { main } from '../../sqldb';

const World = main.World;

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
  console.log(target);
  World.findOne({
    where: {
      name: target,
    },
  })
    .then(handleEntityNotFound(res))
    .then(respondWithResult(res))
    .catch(handleError(res));
}

export function activeWorlds(req, res) {
  World.findAll()
    .then(handleEntityNotFound(res))
    .then(respondWithResult(res))
    .catch(handleError(res));
}
