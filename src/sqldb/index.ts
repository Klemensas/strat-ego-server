import * as Sequelize from 'sequelize';
import config from '../config/environment';

const mainConnection: Sequelize.Sequelize = new Sequelize(config.sequelize.main, config.sequelize.options);
const worldConnection: Sequelize.Sequelize = new Sequelize(config.sequelize.world, config.sequelize.options);

export const main = {
  sequelize: mainConnection,
  User: mainConnection.import('../api/user/user.model'),
  World: mainConnection.import('../api/world/world.model'),
  UserWorlds: mainConnection.define('UserWorlds', {
    PlayerId: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
  }),
};
main.User.hasMany(main.UserWorlds);
main.UserWorlds.belongsTo(main.User);
main.UserWorlds.belongsTo(main.World);

export const world = {
  sequelize: worldConnection,
  Building: worldConnection.import('../api/world/building.model'),
  Unit: worldConnection.import('../api/world/unit.model'),
  Player: worldConnection.import('../api/world/player.model'),
  Town: worldConnection.import('../api/town/town.model'),
  Movement: worldConnection.import('../api/town/movement.model'),
  BuildingQueue: worldConnection.import('../api/world/building.queue.model'),
  UnitQueue: worldConnection.import('../api/world/unit.queue.model'),
  Report: worldConnection.import('../api/report/report.model'),
};
world.Player.hasMany(world.Town);
world.Town.belongsTo(world.Player);
world.Town.hasMany(world.Movement, {
  as: 'MovementOriginTown',
  foreignKey: 'MovementOriginId',
});
world.Town.hasMany(world.Movement, {
  as: 'MovementDestinationTown',
  foreignKey: 'MovementDestinationId',
});
world.Movement.belongsTo(world.Town, {
  as: 'MovementOriginTown',
  foreignKey: 'MovementOriginId',
});
world.Movement.belongsTo(world.Town, {
  as: 'MovementDestinationTown',
  foreignKey: 'MovementDestinationId',
});

world.Town.hasMany(world.Report, {
  as: 'ReportOriginTown',
  foreignKey: 'ReportOriginTownId',
});
world.Town.hasMany(world.Report, {
  as: 'ReportDestinationTown',
  foreignKey: 'ReportDestinationTownId',
});
world.Report.belongsTo(world.Town, {
  as: 'ReportOriginTown',
  foreignKey: 'ReportOriginTownId',
});
world.Report.belongsTo(world.Town, {
  as: 'ReportDestinationTown',
  foreignKey: 'ReportDestinationTownId',
});

world.Player.hasMany(world.Report, {
  as: 'ReportOriginPlayer',
  foreignKey: 'ReportOriginPlayerId',
});
world.Player.hasMany(world.Report, {
  as: 'ReportDestinationPlayer',
  foreignKey: 'ReportDestinationPlayerId',
});
world.Report.belongsTo(world.Player, {
  as: 'ReportOriginPlayer',
  foreignKey: 'ReportOriginPlayerId',
});
world.Report.belongsTo(world.Player, {
  as: 'ReportDestinationPlayer',
  foreignKey: 'ReportDestinationPlayerId',
});

world.Town.hasMany(world.UnitQueue);
world.UnitQueue.belongsTo(world.Town);
world.Town.hasMany(world.BuildingQueue);
world.BuildingQueue.belongsTo(world.Town);
