"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var world_1 = require("./world");
var sqldb_1 = require("../sqldb");
var Town = sqldb_1.world.Town;
var MapManager = (function () {
    function MapManager() {
        this.mapData = {};
    }
    MapManager.prototype.addTown = function (town) {
        // const owner = town
        this.mapData[town.location.join(',')] = {
            _id: town._id,
            name: town.name,
            location: town.location,
        };
    };
    MapManager.prototype.getRingCoords = function (size, ring) {
        var min = size - ring;
        var max = size + ring;
        var halfRing = Math.floor(ring / 2);
        var xLeft = [min, size];
        var xRight = [max, size];
        var top = [];
        var bottom = [];
        var leftTop = [];
        var leftBottom = [];
        var rightTop = [];
        var rightBottom = [];
        for (var i = 0; i < ring + 1; i++) {
            var x = min + halfRing + i;
            top.push([x, min]);
            bottom.push([x, max]);
            if (i < ring - 1) {
                var yT = size - 1 - i;
                var yB = size + 1 + i;
                var xL = min + Math.floor((i + 1) / 2);
                var xR = max - Math.round((1 + i) / 2);
                leftTop.unshift([xL, yT]);
                rightTop.unshift([xR, yT]);
                leftBottom.push([xL, yB]);
                rightBottom.push([xR, yB]);
            }
        }
        return {
            left: leftTop.concat([xLeft], leftBottom),
            right: rightTop.concat([xRight], rightBottom),
            top: top,
            bottom: bottom,
        };
    };
    MapManager.prototype.getCoordsInRange = function (rings, furthestRing, size) {
        var coords = this.getRingCoords(size, furthestRing);
        var innards = coords.left.reduce(function (p, c, i, a) {
            var right = coords.right[i];
            if (i >= rings - 1 && i <= a.length - rings) {
                return p.concat(Array.from({ length: rings }, function (v, j) { return [c[0] + j, c[1]]; }), Array.from({ length: rings }, function (v, j) { return [right[0] - j, right[1]]; }));
            }
            var rowLength = right[0] - c[0] + 1;
            return p.concat(Array.from({ length: rowLength }, function (v, j) { return [c[0] + j, c[1]]; }));
        }, []);
        return coords.top.concat(innards, coords.bottom);
    };
    MapManager.prototype.chooseLocation = function () {
        sqldb_1.world.Town.getAvailableCoords(this.getCoordsInRange(world_1.default.world.generationArea, world_1.default.world.currentRing, Math.ceil(world_1.default.world.size / 2)))
            .then(function (coords) {
            console.log('available coords:', coords);
            return coords;
        })
            .then(function (coords) { return coords[Math.round(Math.random() * (coords.length - 1))]; });
    };
    return MapManager;
}());
exports.default = new MapManager();
//# sourceMappingURL=map.js.map