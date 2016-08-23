'use strict';

import _ from 'lodash';
import { User, Message } from '../../sqldb';
import * as auth from '../../auth/auth.service';

function respondWithResult(res, statusCode) {
  statusCode = statusCode || 200;
  return function(entity) {
    if (entity) {
      res.status(statusCode).json(entity);
    }
  };
}

function saveUpdates(updates) {
  return function(entity) {
    var updated = _.merge(entity, updates);
    return updated.save()
      .spread(updated => {
        return updated;
      });
  };
}

function removeEntity(res) {
  return function(entity) {
    if (entity) {
      return entity.remove()
        .then(() => {
          res.status(204).end();
        });
    }
  };
}

function handleEntityNotFound(res) {
  return function(entity) {
    if (!entity) {
      res.status(404).end();
      return null;
    }
    return entity;
  };
}

function handleError(res, statusCode) {
  statusCode = statusCode || 500;
  return function(err) {
    res.status(statusCode).send(err);
  };
}

// Gets a list of Things
export function index(req, res) {
  res.status(200);
  // return Message.findAll({
  //     limit: 20,
  //     order: [['createdAt', 'DESC']],
  //     include: [
  //       { model: User, required: false, attributes: ['name'] }
  //     ]
  //   }).map(m => {
  //     return {
  //       owner: m.User ? m.User.name : null,
  //       content: m.content,
  //     }
  //   })
  //   .then(respondWithResult(res))
    // .catch(handleError(res));
}

// Gets a single Message from the DB
export function show(req, res) {
  Message.findById(req.params.id)
    .then(handleEntityNotFound(res))
    .then(respondWithResult(res))
    .catch(handleError(res));
}

import expressJwt from 'express-jwt';
import compose from 'composable-middleware';
import config from '../../config/environment';
// import User from '../api/user/user.model';

const validateJwt = expressJwt({
  secret: config.secrets.session,
});

// Creates a new Message in the DB
export function create(req, res) {
  let owner = null;
  if (req.user) {
    owner = req.user.name;
  }
  const msg = new Message({
    content: req.body.message,
    owner,
  });
  msg.save()
    .then(message => {
      res.json({ message });
    });
}

// Updates an existing Message in the DB
export function update(req, res) {
  if (req.body._id) {
    delete req.body._id;
  }
  Message.findById(req.params.id)
    .then(handleEntityNotFound(res))
    .then(saveUpdates(req.body))
    .then(respondWithResult(res))
    .catch(handleError(res));
}

// Deletes a Message from the DB
export function destroy(req, res) {
  Message.findById(req.params.id)
    .then(handleEntityNotFound(res))
    .then(removeEntity(res))
    .catch(handleError(res));
}
