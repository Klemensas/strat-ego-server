"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = function (sequelize, DataTypes) { return sequelize.define('Unit', {
    _id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    attackType: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    speed: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    recruitTime: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    haul: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    requirements: {
        type: DataTypes.ARRAY(DataTypes.JSON),
    },
    costs: {
        type: DataTypes.JSON,
        allowNull: false,
    },
    combat: {
        type: DataTypes.JSON,
        allowNull: false,
    },
}); };
//# sourceMappingURL=unit.model.js.map