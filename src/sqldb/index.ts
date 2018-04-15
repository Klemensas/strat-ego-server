import * as Knex from 'knex';

import * as config from '../config/environment';

export const knexDb = {
  main: Knex({ ...config.knex.options, connection: config.knex.main }),
  world: Knex({ ...config.knex.options, connection: config.knex.world }),
};
