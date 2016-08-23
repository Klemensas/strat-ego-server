import { main } from '../../sqldb';

const World = main.World;

function respondWithResult(res, statusCode) {
  statusCode = statusCode || 200;
  return entity => {
    console.log(entity)
    if (entity) {
      res.status(statusCode).json(entity);
    }
  };
}

function handleEntityNotFound(res) {
  return entity => {
    if (!entity || !entity.length) {
      res.status(404).end();
      return null;
    }
    return entity;
  };
}

function handleError(res, statusCode) {
  statusCode = statusCode || 500;
  return err => {
    res.status(statusCode).send(err);
  };
}

export function activeWorlds(req, res) {
  World.findAll()
    .then(handleEntityNotFound(res))
    .then(respondWithResult(res))
    .catch(handleError(res));
}
