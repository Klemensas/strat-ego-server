import { Sequelize } from 'sequelize';
import config from '../config/environment';

interface Db {
  Sequelize: Sequelize;
  main: {
    sequelize: Sequelize,
    // User?: any,
    // World?: any,
    // UserWorlds?: any,
  };
  world: {
    sequelize: Sequelize,
    // Building?: any,
    // Unit?: any,
    // Player?: any,
    // Town?: any,
    // Movement?: any,
    // BuildingQueue?: any,
    // UnitQueue?: any,
    // Report?: any,
  };
}

const db = {
  Sequelize,
  main: { sequelize: new Sequelize(config.sequelize.main, config.sequelize.options) },
  world: { sequelize: new Sequelize(config.sequelize.world, config.sequelize.options) },
};

export const main = db.main;
export const world = db.world;

import { Player } from '../api/world/Player.model';
import { Town } from '../api/town/Town.model';
import { Movement } from '../api/town/Movement.model';
import { BuildingQueue } from '../api/world/BuildingQueue.model';
import { UnitQueue } from '../api/world/UnitQueue.model';
import { Report } from '../api/report/Report.model';
import { Alliance } from '../api/world/Alliance.model';

Town.belongsTo(Player, { as: 'Player', foreignKey: 'PlayerId' });
Player.hasMany(Town, { as: 'Towns', foreignKey: 'PlayerId' });

Town.hasMany(BuildingQueue, {as: 'BuildingQueues', foreignKey: 'TownId' });
BuildingQueue.belongsTo(Town, { as: 'Town', foreignKey: 'TownId' });

Town.hasMany(UnitQueue, {as: 'UnitQueues', foreignKey: 'TownId' });
UnitQueue.belongsTo(Town, { as: 'Town', foreignKey: 'TownId' });

Town.hasMany(Report, { as: 'ReportOriginTown', foreignKey: 'ReportOriginTownId' });
Report.belongsTo(Town, { as: 'ReportOriginTown', foreignKey: 'ReportOriginTownId' });
Town.hasMany(Report, { as: 'ReportDestinationTown', foreignKey: 'ReportDestinationTownId' });
Report.belongsTo(Town, { as: 'ReportDestinationTown', foreignKey: 'ReportDestinationTownId' });

Town.hasMany(Movement, { as: 'MovementOriginTown', foreignKey: 'MovementOriginId' });
Movement.belongsTo(Town, { as: 'MovementOriginTown', foreignKey: 'MovementOriginId' });
Town.hasMany(Movement, { as: 'MovementDestinationTown', foreignKey: 'MovementDestinationId' });
Movement.belongsTo(Town, { as: 'MovementDestinationTown', foreignKey: 'MovementDestinationId' });

// // Insert models below
// db.main.User = db.main.sequelize.import('../api/user/user.model');
// db.main.World = db.main.sequelize.import('../api/world/world.model');

// db.world.Building = db.world.sequelize.import('../api/world/building.model');
// db.world.Unit = db.world.sequelize.import('../api/world/unit.model');
// db.world.Player = db.world.sequelize.import('../api/world/player.model');
// db.world.Town = db.world.sequelize.import('../api/town/town.model');
// db.world.Movement = db.world.sequelize.import('../api/town/movement.model');
// db.world.BuildingQueue = db.world.sequelize.import('../api/world/building.queue.model');
// db.world.UnitQueue = db.world.sequelize.import('../api/world/unit.queue.model');
// db.world.Report = db.world.sequelize.import('../api/report/report.model');

// // db.World.belongsToMany(db.User, { through: 'WorldUsers' });

// db.main.UserWorlds = db.main.sequelize.define('UserWorlds', {
//   PlayerId: {
//     type: Sequelize.INTEGER,
//     allowNull: false,
//   },
// });

// db.main.User.hasMany(db.main.UserWorlds);
// db.main.UserWorlds.belongsTo(db.main.User);
// db.main.UserWorlds.belongsTo(db.main.World);

// db.world.Player.hasMany(db.world.Town);
// db.world.Town.belongsTo(db.world.Player);

// db.world.Town.hasMany(db.world.Movement, {
//   as: 'MovementOriginTown',
//   foreignKey: 'MovementOriginId',
// });
// db.world.Town.hasMany(db.world.Movement, {
//   as: 'MovementDestinationTown',
//   foreignKey: 'MovementDestinationId',
// });
// db.world.Movement.belongsTo(db.world.Town, {
//   as: 'MovementOriginTown',
//   foreignKey: 'MovementOriginId',
// });
// db.world.Movement.belongsTo(db.world.Town, {
//   as: 'MovementDestinationTown',
//   foreignKey: 'MovementDestinationId',
// });

// db.world.Town.hasMany(db.world.Report, {
//   as: 'ReportOriginTown',
//   foreignKey: 'ReportOriginTownId',
// });
// db.world.Town.hasMany(db.world.Report, {
//   as: 'ReportDestinationTown',
//   foreignKey: 'ReportDestinationTownId',
// });
// db.world.Report.belongsTo(db.world.Town, {
//   as: 'ReportOriginTown',
//   foreignKey: 'ReportOriginTownId',
// });
// db.world.Report.belongsTo(db.world.Town, {
//   as: 'ReportDestinationTown',
//   foreignKey: 'ReportDestinationTownId',
// });

// db.world.Player.hasMany(db.world.Report, {
//   as: 'ReportOriginPlayer',
//   foreignKey: 'ReportOriginPlayerId',
// });
// db.world.Player.hasMany(db.world.Report, {
//   as: 'ReportDestinationPlayer',
//   foreignKey: 'ReportDestinationPlayerId',
// });
// db.world.Report.belongsTo(db.world.Player, {
//   as: 'ReportOriginPlayer',
//   foreignKey: 'ReportOriginPlayerId',
// });
// db.world.Report.belongsTo(db.world.Player, {
//   as: 'ReportDestinationPlayer',
//   foreignKey: 'ReportDestinationPlayerId',
// });

// db.world.Town.hasMany(db.world.UnitQueue);
// db.world.UnitQueue.belongsTo(db.world.Town);
// db.world.Town.hasMany(db.world.BuildingQueue);
// db.world.BuildingQueue.belongsTo(db.world.Town);
