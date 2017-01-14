import path from 'path';
import _ from 'lodash';
import yargs from 'yargs';

const all = {
  env: process.env.NODE_ENV,
  root: path.normalize(path.join(__dirname, '/../../..')),
  port: process.env.PORT || 9000,
  ip: process.env.IP || '0.0.0.0',
  seedDB: true,
  secrets: {
    session: process.env.APP_SECRET || 'secret'
  },
  userRoles: ['user', 'admin']

  // facebook: {
  //   clientID:     process.env.FACEBOOK_ID || 'id',
  //   clientSecret: process.env.FACEBOOK_SECRET || 'secret',
  //   callbackURL:  (process.env.DOMAIN || '') + '/auth/facebook/callback'
  // },
  // twitter: {
  //   clientID:     process.env.TWITTER_ID || 'id',
  //   clientSecret: process.env.TWITTER_SECRET || 'secret',
  //   callbackURL:  (process.env.DOMAIN || '') + '/auth/twitter/callback'
  // },
  // google: {
  //   clientID:     process.env.GOOGLE_ID || 'id',
  //   clientSecret: process.env.GOOGLE_SECRET || 'secret',
  //   callbackURL:  (process.env.DOMAIN || '') + '/auth/google/callback'
  // }
};

const env = yargs.argv.env || `./${all.env}.js`;

export default _.merge(
  all,
  require(env) || {}
);
