import { Sequelize } from 'sequelize';
import * as config from '../config/environment';
import * as Knex from 'knex';

interface KnexDb {
  main: Knex;
  world: Knex;
}

interface Db {
  Sequelize: Sequelize;
  main: {
    sequelize: Sequelize,
    // User?: any,
    // World?: any,
    // UserWorlds?: any,
  };
  world: {
    sequelize: Sequelize,
    // Building?: any,
    // Unit?: any,
    // Player?: any,
    // Town?: any,
    // Movement?: any,
    // BuildingQueue?: any,
    // UnitQueue?: any,
    // Report?: any,
  };
}

export const knexDb = {
  main: Knex({ ...config.knex.options, connection: config.knex.main }),
  world: Knex({ ...config.knex.options, connection: config.knex.world }),
};

const db = {
  Sequelize,
  main: { sequelize: new Sequelize(config.sequelize.main, config.sequelize.options) },
  world: { sequelize: new Sequelize(config.sequelize.world, config.sequelize.options) },
};

export const main = db.main;
export const world = db.world;
