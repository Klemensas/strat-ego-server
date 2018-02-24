import * as passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { logger } from '../../';
import { User } from '../../api/user/User';
import { knexDb } from '../../sqldb';

async function localAuthenticate(email, password, done) {
  try {
    const user = await User.query(knexDb.main).findOne('email', email.toLowerCase())
    if (!user) {
      return done(null, false, {
        message: 'This email is not registered.',
      });
    }
  
    const auth = await user.authenticate(password)
    if (!auth) {
      return done(null, false, { message: 'This password is not correct.' });
    }
    return done(null, user);
  } catch(err) {
    logger.error(err, 'Auth error');
    return done(err);
  }
}

export default () => {
  passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password', // this is the virtual field on the model
  }, (email, password, done) => localAuthenticate(email, password, done)));
};
