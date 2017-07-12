"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var buildingList = [
    {
        name: 'headquarters',
        levels: 15,
        min: 1,
        costs: {
            wood: {
                base: 90,
                factor: 1.56,
            },
            clay: {
                base: 80,
                factor: 1.575,
            },
            iron: {
                base: 70,
                factor: 1.56,
            },
        },
        baseTime: 20,
        timeFactor: 1.4,
    }, {
        name: 'barracks',
        levels: 20,
        min: 0,
        costs: {
            wood: {
                base: 200,
                factor: 1.26,
            },
            clay: {
                base: 170,
                factor: 1.28,
            },
            iron: {
                base: 90,
                factor: 1.26,
            },
        },
        baseTime: 30,
        timeFactor: 1.2,
        additional: {
            recruitment: {
                base: 1,
                factor: 0.96,
            },
        },
        requirements: [{
                item: 'headquarters',
                level: 3,
            }],
    }, {
        name: 'wood',
        levels: 30,
        min: 0,
        costs: {
            wood: {
                base: 50,
                factor: 1.25,
            },
            clay: {
                base: 60,
                factor: 1.275,
            },
            iron: {
                base: 40,
                factor: 1.245,
            },
        },
        baseTime: 15,
        timeFactor: 1.2,
        additional: {
            production: {
                base: 30,
                factor: 1.163118,
            },
        },
    }, {
        name: 'clay',
        levels: 30,
        min: 0,
        costs: {
            wood: {
                base: 65,
                factor: 1.27,
            },
            clay: {
                base: 50,
                factor: 1.265,
            },
            iron: {
                base: 40,
                factor: 1.24,
            },
        },
        baseTime: 15,
        timeFactor: 1.2,
        additional: {
            production: {
                base: 30,
                factor: 1.163118,
            },
        },
    }, {
        name: 'iron',
        levels: 30,
        min: 0,
        costs: {
            wood: {
                base: 75,
                factor: 1.252,
            },
            clay: {
                base: 65,
                factor: 1.275,
            },
            iron: {
                base: 70,
                factor: 1.24,
            },
        },
        baseTime: 18,
        timeFactor: 1.2,
        additional: {
            production: {
                base: 30,
                factor: 1.163118,
            },
        },
    }, {
        name: 'wall',
        levels: 20,
        min: 0,
        costs: {
            wood: {
                base: 50,
                factor: 1.26,
            },
            clay: {
                base: 100,
                factor: 1.275,
            },
            iron: {
                base: 20,
                factor: 1.24,
            },
        },
        baseTime: 60,
        timeFactor: 1.2,
        additional: {
            defense: {
                base: 1.04,
                factor: 1.04,
            },
        },
    }, {
        name: 'storage',
        levels: 30,
        min: 1,
        costs: {
            wood: {
                base: 60,
                factor: 1.265,
            },
            clay: {
                base: 50,
                factor: 1.27,
            },
            iron: {
                base: 40,
                factor: 1.245,
            },
        },
        baseTime: 17,
        timeFactor: 1.2,
        additional: {
            storage: {
                base: 1000,
                factor: 1.2294934,
            },
        },
    }, {
        name: 'farm',
        levels: 30,
        min: 1,
        costs: {
            wood: {
                base: 45,
                factor: 1.3,
            },
            clay: {
                base: 40,
                factor: 1.32,
            },
            iron: {
                base: 30,
                factor: 1.29,
            },
        },
        baseTime: 20,
        timeFactor: 1.2,
        additional: {
            population: {
                base: 240,
                factor: 1.172103,
            },
        },
    }, {
        name: 'castle',
        levels: 1,
        min: 0,
        costs: {
            wood: {
                base: 15000,
            },
            clay: {
                base: 25000,
            },
            iron: {
                base: 10000,
            },
        },
        baseTime: 14400,
        timeFactor: 1,
        requirements: [{
                item: 'headquarters',
                level: 15,
            }],
    },
];
exports.default = function (speed, buildings) {
    if (speed === void 0) { speed = 1; }
    if (buildings === void 0) { buildings = buildingList; }
    return buildings.map(function (building) {
        var item = {
            name: building.name,
            levels: { max: building.levels, min: building.min },
            requirements: building.requirements,
            data: [],
        };
        var _loop_1 = function (i) {
            var data = {
                buildTime: Math.ceil((building.baseTime * (Math.pow(building.timeFactor, i))) / speed) * 1000,
                costs: {
                    wood: Math.ceil(building.costs.wood.base * (Math.pow(building.costs.wood.factor, i))),
                    clay: Math.ceil(building.costs.clay.base * (Math.pow(building.costs.clay.factor, i))),
                    iron: Math.ceil(building.costs.iron.base * (Math.pow(building.costs.iron.factor, i))),
                },
            };
            if (building.additional) {
                Object.entries(building.additional).forEach(function (_a) {
                    var key = _a[0], value = _a[1];
                    var factor = i ? Math.pow(value.factor, (i - 1)) : 0;
                    var base = value.base;
                    data[key] = +(base * factor).toPrecision(3);
                    if (key === 'production') {
                        base *= speed;
                        data[key] = Math.ceil(data[key]);
                    }
                });
            }
            item.data.push(data);
        };
        for (var i = 0; i <= item.levels.max; i++) {
            _loop_1(i);
        }
        return item;
    });
};
//# sourceMappingURL=buildingData.js.map