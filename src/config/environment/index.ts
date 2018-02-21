import * as path from 'path';

export default {
  env: process.env.NODE_ENV,
  ip: process.env.IP || '0.0.0.0',
  port: process.env.PORT || 9000,
  root: path.normalize(path.join(__dirname, '/../../..')),
  secrets: {
    session: process.env.APP_SECRET || 'secret',
  },
  userRoles: ['user', 'admin'],
  seedDB: process.env.SEED_DATA || false,
  sequelize: {
    options: {
      logging: false/* console.log */,
      define: {
        timestamps: true,
        paranoid: false,
        version: true,
      },
    },
    main: process.env.DB_MAIN || 'postgres://stratego:supasecretpassword@localhost:5432/stratego',
    world: process.env.DB_WORLD || 'postgres://stratego:supasecretpassword@localhost:5432/strategoWorld',
  },
};
