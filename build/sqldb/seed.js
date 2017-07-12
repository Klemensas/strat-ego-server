"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var index_1 = require("./index");
var buildingData_1 = require("../config/game/buildingData");
var unitData_1 = require("../config/game/unitData");
var map_1 = require("../components/map");
exports.default = function () {
    var User = index_1.main.User;
    var World = index_1.main.World;
    var UserWorlds = index_1.main.UserWorlds;
    var Player = index_1.world.Player;
    var Town = index_1.world.Town;
    var Building = index_1.world.Building;
    var Unit = index_1.world.Unit;
    var Movement = index_1.world.Movement;
    var Report = index_1.world.Report;
    var worldData = {
        name: 'Megapolis',
        baseProduction: 500,
        speed: 1,
        size: 999,
        regionSize: 27,
        fillTime: (90 * 24 * 60 * 60 * 1000),
        fillPercent: 0.8,
        barbPercent: 0.6,
        timeQouta: 0.4,
        generationArea: 9,
        currentRing: 1,
    };
    var userData = [
        {
            provider: 'local',
            name: 'Test User',
            email: 'test@test.com',
            password: 'test',
        }, {
            provider: 'local',
            role: 'admin',
            name: 'Admin',
            email: 'admin@admin.com',
            password: 'test',
        },
    ];
    var townGenerationData = {
        percent: 0.5,
        furthestRing: worldData.generationArea,
        area: worldData.generationArea,
        size: Math.ceil(worldData.size / 2),
    };
    function seedTowns(coords, factor) {
        console.log("seeding towns in " + coords.length + " fields at " + factor + " factor");
        return coords.reduce(function (towns, value) {
            if (Math.random() > factor) {
                return towns;
            }
            towns.push({ location: value });
            return towns;
        }, []);
    }
    return Promise.all([
        World.sync().then(function () { return World.destroy({ where: {} }); }),
        Building.sync().then(function () { return Building.destroy({ where: {} }); }),
        Unit.sync().then(function () { return Unit.destroy({ where: {} }); }),
        Player.sync().then(function () { return Player.destroy({ where: {} }); }),
        UserWorlds.sync().then(function () { return UserWorlds.destroy({ where: {} }); }),
        Town.sync().then(function () { return Town.destroy({ where: {} }); }),
        User.sync().then(function () { return User.destroy({ where: {} }); }),
        Movement.sync().then(function () { return Movement.destroy({ where: {} }); }),
        Report.sync().then(function () { return Report.destroy({ where: {} }); }),
    ])
        .then(function () { return Promise.all([
        World.create(worldData),
        User.bulkCreate(userData),
        Building.bulkCreate(buildingData_1.default(worldData.speed)),
        Unit.bulkCreate(unitData_1.default(worldData.speed)),
    ]); })
        .then(function () { return Town.bulkCreate(seedTowns(map_1.default.getCoordsInRange(townGenerationData.area, townGenerationData.furthestRing, townGenerationData.size), townGenerationData.percent)); })
        .then(function () { return console.log('Seeding done.'); })
        .catch(function (error) { return console.log('Seeding error', error); });
};
//# sourceMappingURL=seed.js.map