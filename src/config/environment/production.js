exports = module.exports = {
  ip: process.env.OPENSHIFT_NODEJS_IP ||
    process.env.IP ||
    undefined,
  port: process.env.OPENSHIFT_NODEJS_PORT ||
    process.env.PORT ||
    80,
  sequelize: {
    options: {
      logging: false/* console.log*/,
      define: {
        timestamps: true,
        paranoid: false
      },
    },
    main: process.env.DB_MAIN || 'postgres://ffe:test@localhost:5432/ffe',
    world: process.env.DB_WORLD || 'postgres://ffe:test@localhost:5432/ffeWorld'
  }
};
