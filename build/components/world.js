"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var sqldb_1 = require("../sqldb");
var WorldData = (function () {
    function WorldData() {
        this.world = {};
        this.units = [];
        this.unitMap = {};
        this.buildings = [];
        this.buildingMap = {};
    }
    WorldData.prototype.readWorld = function (name) {
        var _this = this;
        return sqldb_1.main.World.findOne({ where: { name: name }, raw: true })
            .then(function (config) {
            _this.world = config;
            return Promise.all([
                sqldb_1.world.Building.findAll({ raw: true }),
                sqldb_1.world.Unit.findAll({ raw: true }),
            ]);
        })
            .then(function (_a) {
            var buildings = _a[0], units = _a[1];
            _this.buildings = buildings;
            _this.buildingMap = buildings.reduce(function (map, item) {
                map[item.name] = item;
                return map;
            }, {});
            _this.units = units;
            _this.unitMap = units.reduce(function (map, item) {
                map[item.name] = item;
                return map;
            }, {});
        })
            .catch(function (error) { return console.log('Error read world.', error); });
    };
    return WorldData;
}());
exports.default = new WorldData();
//# sourceMappingURL=world.js.map