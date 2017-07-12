"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var app_1 = require("../../app");
var world_1 = require("../../components/world");
exports.default = function (sequelize, DataTypes) {
    var Town = sequelize.define('Town', {
        _id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        name: {
            type: DataTypes.STRING,
            validate: {
                notEmpty: true,
                len: [1, 50],
            },
            defaultValue: 'Abandoned Town',
        },
        loaylty: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 100,
        },
        location: {
            type: DataTypes.ARRAY(DataTypes.INTEGER),
            allowNull: false,
            validate: {
                notEmpty: true,
                len: [2, 2],
            },
            unique: true,
        },
        production: {
            type: DataTypes.JSON,
        },
        resources: {
            type: DataTypes.JSON,
            validate: {
                isPositive: function (resources) {
                    var invalid = Object.keys(resources).some(function (i) { return resources[i] < 0; });
                    if (invalid) {
                        throw new Error("Resources can't be negative. Last updated at " + this.updatedAt);
                    }
                },
            },
        },
        buildings: {
            type: DataTypes.JSONB,
        },
        units: {
            type: DataTypes.JSONB,
            validate: {
                isPositive: function (units) {
                    var invalid = Object.keys(units).some(function (i) { return units[i].inside < 0 || units[i].outside < 0; });
                    if (invalid) {
                        throw new Error("Units can't be negative. Last updated at " + this.updatedAt);
                    }
                },
            },
        },
    }, {
        hooks: {
            beforeBulkCreate: function (towns) {
                var buildings = world_1.default.buildings.reduce(function (map, item) {
                    map[item.name] = { level: item.levels.min, queued: 0 };
                    return map;
                }, {});
                var units = world_1.default.units.reduce(function (map, item) {
                    map[item.name] = { inside: 0, outside: 0, queued: 0 };
                    return map;
                }, {});
                var resources = {
                    wood: 800,
                    clay: 800,
                    iron: 800,
                };
                return towns.map(function (town) {
                    town.buildings = buildings;
                    town.units = units;
                    town.resources = resources;
                    town.production = town.calculateProduction();
                    return town;
                });
            },
            beforeCreate: function (town) {
                var buildings = world_1.default.buildings.reduce(function (map, item) {
                    map[item.name] = { level: item.levels.min, queued: 0 };
                    return map;
                }, {});
                var units = world_1.default.units.reduce(function (map, item) {
                    map[item.name] = { inside: 0, outside: 0, queued: 0 };
                    return map;
                }, {});
                // Town.resources
                town.resources = {
                    wood: 800,
                    clay: 800,
                    iron: 800,
                };
                town.buildings = buildings;
                town.production = town.calculateProduction();
                town.units = units;
            },
            beforeUpdate: function (town) {
                // Update res if not marked as changed
                if (!town.changed('resources')) {
                    town.updateRes(town.updatedAt, town.previous('updatedAt'));
                }
                // Recalculate production if buildings updated
                if (town.changed('buildings')) {
                    town.production = town.calculateProduction();
                }
            },
            // afterUpdate: town => {
            //   town.getBuildingQueues()
            //     .then(queues => {
            //       town.setDataValue('BuildingQueues', queues);
            //       console.log(`Town ${town._id} updated, sending data to sockets`);
            //     });
            // },
            afterCreate: function (town) {
                town.reload({ include: [{ all: true }] })
                    .then(function (fullTown) { return mapData.addTown(fullTown); });
            },
        },
        instanceMethods: {
            notifySave: function (event, transaction) {
                return this.save({ transaction: transaction })
                    .then(function (town) { return town.reload({ include: [{ all: true }] }); })
                    .then(function (town) {
                    app_1.io.sockets.in(town._id).emit('town', { town: town, event: event });
                    return town;
                });
            },
            notify: function (event) {
                return this.reload({ include: [{ all: true }] })
                    .then(function (town) { return app_1.io.sockets.in(town._id).emit('town', { town: town, event: event }); });
            },
            // TODO: fix this, apparently, hooks already have updated data so can't get good updatedAt,
            // setting silent prevents updatedAt from updating even when doing so manually...
            updateRes: function (now, previous) {
                if (previous === void 0) { previous = this.updatedAt; }
                var timePast = (now - new Date(previous).getTime()) / 1000 / 60 / 60;
                var maxRes = this.getMaxRes();
                var clay = this.resources.clay + this.production.clay * timePast;
                var wood = this.resources.wood + this.production.wood * timePast;
                var iron = this.resources.iron + this.production.iron * timePast;
                this.resources = {
                    clay: Math.min(maxRes, clay),
                    wood: Math.min(maxRes, wood),
                    iron: Math.min(maxRes, iron),
                };
                return this;
            },
            calculateProduction: function () {
                var buildingData = world_1.default.buildingMap;
                return {
                    wood: world_1.default.world.baseProduction + buildingData.wood.data[this.buildings.wood.level].production,
                    clay: world_1.default.world.baseProduction + buildingData.clay.data[this.buildings.clay.level].production,
                    iron: world_1.default.world.baseProduction + buildingData.iron.data[this.buildings.iron.level].production,
                };
            },
            getLastQueue: function (queue) {
                return this[queue].sort(function (a, b) { return b.endsAt.getTime() - a.endsAt.getTime(); })[0];
            },
            checkBuildingRequirements: function (requirements) {
                var _this = this;
                return requirements ?
                    requirements.every(function (_a) {
                        var item = _a.item, level = _a.level;
                        return _this.buildings[item].level >= level;
                    }) :
                    true;
            },
            getMaxRes: function () {
                return world_1.default.buildingMap.storage.data[this.buildings.storage.level].storage;
            },
            getWallBonus: function () {
                return world_1.default.buildingMap.wall.data[this.buildings.wall.level].defense || 1;
            },
            getRecruitmentModifier: function () {
                return world_1.default.buildingMap.barracks.data[this.buildings.barracks.level].recruitment;
            },
            getAvailablePopulation: function () {
                var _this = this;
                var used = world_1.default.units.reduce(function (total, unit) {
                    return total + Object.values(_this.units[unit.name]).reduce(function (a, b) { return a + b; });
                }, 0);
                var total = world_1.default.buildingMap.farm.data[this.buildings.farm.level].population;
                return total - used;
            },
            processQueues: function () {
                var _this = this;
                var doneBuildings = [];
                var doneUnits = [];
                this.BuildingQueues.forEach(function (queue) {
                    var building = _this.buildings[queue.building];
                    building.level++;
                    if (building.queued === building.level) {
                        building.queued = 0;
                    }
                    doneBuildings.push(queue._id);
                });
                this.UnitQueues.forEach(function (queue) {
                    var unit = _this.units[queue.unit];
                    unit.inside += queue.amount;
                    unit.queued -= queue.amount;
                    doneUnits.push(queue._id);
                });
                return this.resolveAllMovements().then(function (town) {
                    // trigger change manully, because sequalize can't detect it
                    if (doneBuildings.length) {
                        town.changed('buildings', true);
                    }
                    town.changed('units', true);
                    town.doneBuildings = doneBuildings;
                    town.doneUnits = doneUnits;
                    return town;
                });
            },
            resolveAllMovements: function () {
                var _this = this;
                if (this.MovementDestinationTown.length) {
                    var movement = this.MovementDestinationTown.shift();
                    return Town.resolveMovement(movement, this)
                        .then(function () { return Town.findById(_this._id, { include: [{ all: true }] }); })
                        .then(function (town) {
                        if (town.MovementDestinationTown.length) {
                            return town.resolveAllMovements();
                        }
                        return town;
                    });
                }
                else if (this.MovementOriginTown.length) {
                    var movement_1 = this.MovementOriginTown.shift();
                    return Town.findById(movement_1.MovementDestinationId)
                        .then(function (town) { return Town.resolveMovement(movement_1, town); })
                        .then(function () { return Town.findById(_this._id, { include: [{ all: true }] }); })
                        .then(function (town) {
                        if (town.MovementOriginTown.length) {
                            return town.resolveAllMovements();
                        }
                        return town;
                    });
                }
                return Promise.resolve(this);
            },
        },
        classMethods: {
            resolveMovement: function (movement, destinationTown) {
                var resolver = null;
                switch (movement.type) {
                    case 'attack':
                        resolver = resolveAttack;
                        break;
                    case 'return':
                        resolver = resolveReturn;
                        break;
                    case 'support':
                        resolver = resolveSupport;
                        break;
                }
                console.log('hmmm', movement.type, movement.units, destinationTown);
                console.log('attempting to resolve', movement.type, movement.units, destinationTown.dataValues.units);
                return resolver(movement, destinationTown);
            },
            getAvailableCoords: function (allCoords) {
                return Town.findAll({
                    attributes: ['location'],
                    where: {
                        location: {
                            $in: allCoords.slice(),
                        },
                    },
                    raw: true,
                })
                    .then(function (towns) {
                    var usedLocations = towns.map(function (town) { return town.location.join(','); });
                    return allCoords.filter(function (c) { return !usedLocations.includes(c.join(',')); });
                });
            },
            offsetToCube: function (coords) {
                var off = 1;
                var x = coords[0] - Math.trunc((coords[1] + off * (coords[1] % 2)) / 2);
                var z = coords[1];
                return {
                    x: x,
                    z: z,
                    y: -x - z,
                };
            },
            calculateDistance: function (originCoords, targetCoords) {
                var origin = Town.offsetToCube(originCoords);
                var target = Town.offsetToCube(targetCoords);
                return Math.max(Math.abs(origin.x - target.x), Math.abs(origin.y - target.y), Math.abs(origin.z - target.z));
            },
        },
    });
    return Town;
};
//# sourceMappingURL=town.model.js.map