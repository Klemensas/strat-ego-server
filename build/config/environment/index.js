"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var path = require("path");
exports.default = {
    env: process.env.NODE_ENV,
    ip: process.env.IP || '0.0.0.0',
    port: process.env.PORT || 9000,
    root: path.normalize(path.join(__dirname, '/../../..')),
    secrets: {
        session: process.env.APP_SECRET || 'secret',
    },
    userRoles: ['user', 'admin'],
    seedDB: process.env.SEED_DATA || true,
    sequelize: {
        options: {
            logging: false /* console.log*/,
            define: {
                timestamps: true,
                paranoid: false,
            },
        },
        main: process.env.DB_MAIN || 'postgres://ffe:test@localhost:5432/ffe',
        world: process.env.DB_WORLD || 'postgres://ffe:test@localhost:5432/ffeWorld',
    },
};
//# sourceMappingURL=index.js.map