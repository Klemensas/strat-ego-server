export default (sequelize, DataTypes) => sequelize.define('Unit', {
  _id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  type: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: false,
  },
  speed: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  recruitTime: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  haul: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  requirements: {
    type: DataTypes.ARRAY(DataTypes.JSON),
  },
  costs: {
    type: DataTypes.JSON,
    allowNull: false,
  },
  combat: {
    type: DataTypes.JSON,
    allowNull: false,
  },
});
