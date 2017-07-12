"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var express = require("express");
var http = require("http");
var socket = require("socket.io");
var uws = require("uws");
var bodyParser = require("body-parser");
var cors = require("cors");
var morgan = require("morgan");
var compression = require("compression");
var methodOverride = require("method-override");
var errorHandler = require("errorhandler");
var passport = require("passport");
var statusMonitor = require("express-status-monitor");
var environment_1 = require("./config/environment");
var sqldb_1 = require("./sqldb");
var seed_1 = require("./sqldb/seed");
var world_1 = require("./components/world");
var app = express();
var env = app.get('env');
var server = http.createServer(app);
exports.io = socket(server, {
    path: '/socket.io-client',
    serveClient: environment_1.default.env !== 'production',
});
exports.io.engine.ws = new uws.Server({
    noServer: true,
    perMessageDeflate: false,
});
server.listen(environment_1.default.port);
app.use(compression());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(methodOverride());
app.use(passport.initialize());
app.use(morgan('dev'));
app.use(cors());
sqldb_1.main.sequelize.sync()
    .then(function () { return sqldb_1.world.sequelize.sync(); })
    .then(function () { return (environment_1.default.seedDB ? seed_1.default : null); })
    .then(function () { return world_1.default.readWorld('Megapolis'); });
if (env === 'development' || env === 'test') {
    app.use(statusMonitor());
    app.use(errorHandler()); // Error handler - has to be last
}
//# sourceMappingURL=index.js.map