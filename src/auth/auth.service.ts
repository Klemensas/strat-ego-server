import * as jwt from 'jsonwebtoken';
import * as expressJwt from 'express-jwt';
import * as compose from 'composable-middleware';
import * as config from '../config/environment';

import { User } from '../api/user/user';
import { knexDb } from '../sqldb';

const validateJwt = expressJwt({
  secret: config.secrets.session,
});

function validate(req, res, next) {
  // allow access_token to be passed through query parameter as well
  if (req.query && req.query.hasOwnProperty('access_token')) {
    req.headers.authorization = `Bearer ${req.query.access_token}`;
  }
  validateJwt(req, res, next);
}

export function isAuthenticated() {
  return compose()
    .use(validate)
    .use((req, res, next) => {
      User
        .query(knexDb.main)
        .findById(req.user.id)
        .select('id', 'name', 'email', 'role', 'provider', 'createdAt', 'updatedAt')
        .eager('worlds')
        .then((user) => {
          if (!user) {
            return res.status(401).end();
          }
          req.user = user;
          return next();
        })
        .catch((err) => next(err));
    });
}

export function hasRole(roleRequired) {
  if (!roleRequired) {
    throw new Error('Required role needs to be set');
  }
  return compose()
    .use(isAuthenticated())
    .use((req, res, next) => {
      if (config.userRoles.indexOf(req.user.role) >=
        config.userRoles.indexOf(roleRequired)) {
        next();
      } else {
        res.status(403).send('Forbidden');
      }
    });
}

export function signToken(data) {
  const tokenData = {
    name: data.name,
    id: data.id,
    role: data.role,
  };
  return jwt.sign(tokenData, config.secrets.session, {
    expiresIn: 18000,
  });
}
