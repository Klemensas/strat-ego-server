"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = function (sequelize, DataTypes) { return sequelize.define('Player', {
    _id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
    },
    UserId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
}, {
    hooks: {
        beforeBulkCreate: function () {
            return null;
        },
    },
}); };
//# sourceMappingURL=player.model.js.map