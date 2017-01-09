// import passport from 'passport';
import config from '../config/environment';
import jwt from 'jsonwebtoken';
import expressJwt from 'express-jwt';
import compose from 'composable-middleware';
import { main } from '../sqldb';

const User = main.User;
const UserWorlds = main.UserWorlds;

const validateJwt = expressJwt({
  secret: config.secrets.session,
});

/**
 * Attaches the user object to the request if authenticated
 * Otherwise returns 403
 */
function validate(req, res, next) {
  // allow access_token to be passed through query parameter as well
  if (req.query && req.query.hasOwnProperty('access_token')) {
    req.headers.authorization = `Bearer ${req.query.access_token}`;
  }
  validateJwt(req, res, next);
}

export function isAuthenticated() {
  return compose()
    // Validate jwt
    .use(validate)
    // Attach user to request
    .use((req, res, next) => {
      User.findOne({
        where: {
          _id: req.user._id,
        },
        include: [{
          model: UserWorlds,
        }],
      })
        .then(user => {
          if (!user) {
            return res.status(401).end();
          }
          req.user = user;
          return next();
        })
        .catch(err => next(err));
    });
}

export function userIfLoggedIn() {
  return compose()
    .use((req, res, next) => {
      if (req.query && req.query.hasOwnProperty('access_token')) {
        req.headers.authorization = 'Bearer ' + req.query.access_token;
      }
      if (typeof req.headers.authorization !== 'undefined') {
        validateJwt(req, res, next);
      } else {
        next();
      }
    })
    .use((req, res, next) => {
      if (typeof req.user !== 'undefined') {
        User.findById(req.user._id)
          .then(user => {
            if (!user) {
              return res.status(401).end();
            }
            req.user = user;
            next();
          })
          .catch(err => next(err));
      } else {
        next();
      }
    });
}

/**
 * Checks if the user role meets the minimum requirements of the route
 */
export function hasRole(roleRequired) {
  if (!roleRequired) {
    throw new Error('Required role needs to be set');
  }

  return compose()
    .use(isAuthenticated())
    .use(function meetsRequirements(req, res, next) {
      if (config.userRoles.indexOf(req.user.role) >=
        config.userRoles.indexOf(roleRequired)) {
        next();
      } else {
        res.status(403).send('Forbidden');
      }
    });
}

/**
 * Returns a jwt token signed by the app secret
 */
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

/**
 * Set token cookie directly for oAuth strategies
 */
export function setTokenCookie  (req, res) {
  if (!req.user) {
    return res.status(404).send('It looks like you aren\'t logged in, please try again.');
  }
  const token = signToken(req.user);
  res.cookie('token', token);
  res.redirect('/');
}
