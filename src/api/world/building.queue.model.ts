export default (sequelize, DataTypes) => sequelize.define('BuildingQueue', {
  _id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  building: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  level: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  buildTime: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  endsAt: {
    type: DataTypes.DATE,
  },
});
