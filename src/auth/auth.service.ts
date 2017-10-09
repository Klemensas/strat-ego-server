import * as jwt from 'jsonwebtoken';
import * as expressJwt from 'express-jwt';
import * as compose from 'composable-middleware';
import config from '../config/environment';
import { User } from '../api/world/User.model';
import { UserWorld } from '../api/world/UserWorld.model';
import { World } from '../api/world/World.model';

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
      User.findOne({
        where: {
          _id: req.user._id,
        },
        include: [{
          model: World,
        }],
      })
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
    _id: data._id,
    role: data.role,
  };
  return jwt.sign(tokenData, config.secrets.session, {
    expiresIn: 18000,
  });
}
