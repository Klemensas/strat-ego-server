"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var http_1 = require("http");
var socket_io_1 = require("socket.io");
var uws_1 = require("uws");
var sqldb_1 = require("./sqldb");
var environment_1 = require("./config/environment");
var socket_1 = require("./config/socket");
var map_1 = require("./config/game/map");
var routes_1 = require("./routes");
var express_2 = require("./config/express");
var seed_1 = require("./config/seed");
var queue_1 = require("./api/world/queue");
var worlds_1 = require("./components/worlds");
// import * as redis from 'redis';
// bluebird.promisifyAll(redis.RedisClient.prototype);
// bluebird.promisifyAll(redis.Multi.prototype);
// import map from './components/map';
exports.app = express_1.default();
var server = http_1.default.createServer(exports.app);
exports.io = socket_io_1.default(server, {
    serveClient: environment_1.default.env !== 'production',
    path: '/socket.io-client',
});
exports.io.engine.ws = new uws_1.default.Server({
    noServer: true,
    perMessageDeflate: false
});
express_2.default(exports.app);
routes_1.default(exports.app);
sqldb_1.main.sequelize.sync()
    .then(function () { return sqldb_1.world.sequelize.sync(); })
    .then(function () { return (environment_1.default.seedDB ? seed_1.default() : worlds_1.readWorld('Megapolis')); })
    .then(function () { return map_1.default.initialize(sqldb_1.world); })
    .then(function (worldData) {
    queue_1.default.init();
    socket_1.default(exports.io);
})
    .then(function () {
    exports.app.server = server.listen(environment_1.default.port, environment_1.default.ip, function () {
        console.log('Express server listening on %d, in %s mode', environment_1.default.port, exports.app.get('env'));
    });
}) // TODO: separate this into a startup service
    .catch(function (err) { return console.log('Server failed to start due to error: %s', err); });
//# sourceMappingURL=app.js.map