export default function (sequelize, DataTypes) {
  return sequelize.define('World', {
    name: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.STRING,
    },
    baseProduction: {
      type: DataTypes.INTEGER,
    },
    speed: {
      type: DataTypes.INTEGER,
    },
    moneyConversion: {
      type: DataTypes.INTEGER,
    },
    size: {
      type: DataTypes.INTEGER,
      // TODO: add matcher of odd number
    },
    regionSize: {
      type: DataTypes.INTEGER,
      // TODO: add verification that divisable by size
    },
    fillTime: {
      type: DataTypes.BIGINT,
    },
    fillPercent: {
      type: DataTypes.INTEGER,
    },
    barbPercent: {
      type: DataTypes.INTEGER,
    },
    timeQouta: {
      type: DataTypes.INTEGER,
    },
    generationArea: {
      type: DataTypes.INTEGER,
    },
    currentRing: {
      type: DataTypes.INTEGER,
    },
  });
}
