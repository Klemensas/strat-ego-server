exports = module.exports = {
  sequelize: {
    options: {
      logging: false,
      // logging: console.log,
      define: {
        timestamps: true,
        paranoid: false
      },
      dialectOptions: {
        supportBigNumbers: true
      }
    },
    main: process.env.DB_MAIN || 'postgres://ffe:test@127.0.0.1:5432/ffe',
    world: process.env.DB_WORLD || 'postgres://ffe:test@127.0.0.1:5432/ffeWorld'
  },
  seedDB: true
};
