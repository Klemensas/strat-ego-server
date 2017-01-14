import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';

function localAuthenticate(User, email, password, done) {
  User.findOne({
    where: {
      email: email.toLowerCase(),
    },
  })
    .then(user => {
      if (!user) {
        return done(null, false, {
          message: 'This email is not registered.',
        });
      }
      return user.authenticate(password, (authError, authenticated) => {
        if (authError) {
          return done(authError);
        }
        if (!authenticated) {
          return done(null, false, { message: 'This password is not correct.' });
        }
        return done(null, user);
      });
    })
    .catch(err => {
      console.log('error', err);
      return done(err);
    });
}

export default (User, config) => {
  passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password', // this is the virtual field on the model
  }, (email, password, done) => localAuthenticate(User, email, password, done)));
};
