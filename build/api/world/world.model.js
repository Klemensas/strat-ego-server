"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = function (sequelize, DataTypes) { return sequelize.define('World', {
    name: {
        allowNull: false,
        primaryKey: true,
        type: DataTypes.STRING,
    },
    baseProduction: {
        type: DataTypes.INTEGER,
    },
    speed: {
        type: DataTypes.INTEGER,
    },
    size: {
        type: DataTypes.INTEGER,
    },
    regionSize: {
        type: DataTypes.INTEGER,
    },
    fillTime: {
        type: DataTypes.BIGINT,
    },
    fillPercent: {
        type: DataTypes.INTEGER,
    },
    barbPercent: {
        type: DataTypes.INTEGER,
    },
    timeQouta: {
        type: DataTypes.INTEGER,
    },
    generationArea: {
        type: DataTypes.INTEGER,
    },
    currentRing: {
        type: DataTypes.INTEGER,
    },
}); };
//# sourceMappingURL=world.model.js.map