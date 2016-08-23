'use strict';

// Production specific configuration
// =================================
module.exports = {
  // Server IP
  ip:     process.env.OPENSHIFT_NODEJS_IP ||
          process.env.IP ||
          undefined,

  // Server port
  port:   process.env.OPENSHIFT_NODEJS_PORT ||
          process.env.PORT ||
          80,

  sequelize: {
      options: {
        logging: false/* console.log*/,
        define: {
          timestamps: true,
          paranoid: false
        }
      },
      main: 'postgres://ffe:test@localhost:5432/ffe',
      world: 'postgres://ffe:test@localhost:5432/ffeWorld'
  }
};
