import * as passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { User } from '../../api/world/User.model';
import { logger } from '../../';

function localAuthenticate(email, password, done) {
  User.findOne({
    where: {
      email: email.toLowerCase(),
    },
  })
    .then((user) => {
      if (!user) {
        return done(null, false, {
          message: 'This email is not registered.',
        });
      }
      return user.authenticate(password)
        .then((auth) => {
          if (!auth) {
            return done(null, false, { message: 'This password is not correct.' });
          }
          return done(null, user);
        });
    })
    .catch((err) => {
      logger.error(err, 'Auth error');
      return done(err);
    });
}

export default () => {
  passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password', // this is the virtual field on the model
  }, (email, password, done) => localAuthenticate(email, password, done)));
};
