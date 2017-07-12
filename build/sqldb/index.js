"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Sequelize = require("sequelize");
var environment_1 = require("../config/environment");
var mainConnection = new Sequelize(environment_1.default.sequelize.main, environment_1.default.sequelize.options);
var worldConnection = new Sequelize(environment_1.default.sequelize.world, environment_1.default.sequelize.options);
exports.main = {
    sequelize: mainConnection,
    User: mainConnection.import('../api/user/user.model'),
    World: mainConnection.import('../api/world/world.model'),
    UserWorlds: mainConnection.define('UserWorlds', {
        PlayerId: {
            type: Sequelize.INTEGER,
            allowNull: false,
        },
    }),
};
exports.main.User.hasMany(exports.main.UserWorlds);
exports.main.UserWorlds.belongsTo(exports.main.User);
exports.main.UserWorlds.belongsTo(exports.main.World);
exports.world = {
    sequelize: worldConnection,
    Building: worldConnection.import('../api/world/building.model'),
    Unit: worldConnection.import('../api/world/unit.model'),
    Player: worldConnection.import('../api/world/player.model'),
    Town: worldConnection.import('../api/town/town.model'),
    Movement: worldConnection.import('../api/town/movement.model'),
    BuildingQueue: worldConnection.import('../api/world/building.queue.model'),
    UnitQueue: worldConnection.import('../api/world/unit.queue.model'),
    Report: worldConnection.import('../api/report/report.model'),
};
exports.world.Player.hasMany(exports.world.Town);
exports.world.Town.belongsTo(exports.world.Player);
exports.world.Town.hasMany(exports.world.Movement, {
    as: 'MovementOriginTown',
    foreignKey: 'MovementOriginId',
});
exports.world.Town.hasMany(exports.world.Movement, {
    as: 'MovementDestinationTown',
    foreignKey: 'MovementDestinationId',
});
exports.world.Movement.belongsTo(exports.world.Town, {
    as: 'MovementOriginTown',
    foreignKey: 'MovementOriginId',
});
exports.world.Movement.belongsTo(exports.world.Town, {
    as: 'MovementDestinationTown',
    foreignKey: 'MovementDestinationId',
});
exports.world.Town.hasMany(exports.world.Report, {
    as: 'ReportOriginTown',
    foreignKey: 'ReportOriginTownId',
});
exports.world.Town.hasMany(exports.world.Report, {
    as: 'ReportDestinationTown',
    foreignKey: 'ReportDestinationTownId',
});
exports.world.Report.belongsTo(exports.world.Town, {
    as: 'ReportOriginTown',
    foreignKey: 'ReportOriginTownId',
});
exports.world.Report.belongsTo(exports.world.Town, {
    as: 'ReportDestinationTown',
    foreignKey: 'ReportDestinationTownId',
});
exports.world.Player.hasMany(exports.world.Report, {
    as: 'ReportOriginPlayer',
    foreignKey: 'ReportOriginPlayerId',
});
exports.world.Player.hasMany(exports.world.Report, {
    as: 'ReportDestinationPlayer',
    foreignKey: 'ReportDestinationPlayerId',
});
exports.world.Report.belongsTo(exports.world.Player, {
    as: 'ReportOriginPlayer',
    foreignKey: 'ReportOriginPlayerId',
});
exports.world.Report.belongsTo(exports.world.Player, {
    as: 'ReportDestinationPlayer',
    foreignKey: 'ReportDestinationPlayerId',
});
exports.world.Town.hasMany(exports.world.UnitQueue);
exports.world.UnitQueue.belongsTo(exports.world.Town);
exports.world.Town.hasMany(exports.world.BuildingQueue);
exports.world.BuildingQueue.belongsTo(exports.world.Town);
//# sourceMappingURL=index.js.map