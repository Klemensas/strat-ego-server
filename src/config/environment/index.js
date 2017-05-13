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
};

const env = yargs.argv.env || `./${all.env}.js`;

export default _.merge(
  all,
  require(env) || {}
);
