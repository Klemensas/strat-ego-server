export default (sequelize, DataTypes) => sequelize.define('Movement', {
  _id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  units: {
    type: DataTypes.JSON,
    allowNull: false,
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false
  },
  endsAt: {
    type: DataTypes.DATE,
  },
});
