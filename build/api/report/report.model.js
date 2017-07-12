"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var app_1 = require("../../app");
exports.default = function (sequelize, DataTypes) { return sequelize.define('Report', {
    _id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
    },
    outcome: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    origin: {
        type: DataTypes.JSONB,
        allowNull: false,
    },
    destination: {
        type: DataTypes.JSONB,
        allowNull: false,
    },
    haul: {
        type: DataTypes.JSON,
    },
}, {
    hooks: {
        afterCreate: function (report) {
            app_1.io.sockets.in(report.ReportOriginTownId).emit('report', report);
            if (report.ReportDestinationPlayerId) {
                app_1.io.sockets.in(report.ReportDestinationTownId).emit('report', report);
            }
        },
    },
}); };
//# sourceMappingURL=report.model.js.map