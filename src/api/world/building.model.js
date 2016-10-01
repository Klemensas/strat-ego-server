export default function (sequelize, DataTypes) {
  return sequelize.define('Building', {
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
    levels: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    requirements: {
      type: DataTypes.ARRAY(DataTypes.JSON),
    },
    data: {
      type: DataTypes.JSON,
      allowNull: false,
    },
  });
}
