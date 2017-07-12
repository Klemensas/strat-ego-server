import { io } from '../../';

export default (sequelize, DataTypes) => sequelize.define('Report', {
  _id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  outcome: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  origin: {
    type: DataTypes.JSONB,
    allowNull: false,
  },
  destination: {
    type: DataTypes.JSONB,
    allowNull: false,
  },
  haul: {
    type: DataTypes.JSON,
  },
}, {
  hooks: {
    afterCreate: (report) => {
      io.sockets.in(report.ReportOriginTownId).emit('report', report);
      if (report.ReportDestinationPlayerId) {
        io.sockets.in(report.ReportDestinationTownId).emit('report', report);
      }
    },
  },
});
