export default function (sequelize, DataTypes) {
  return sequelize.define('UnitQueue', {
    _id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
    },
    unit: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    amount: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    recruitTime: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    endsAt: {
      type: DataTypes.DATE,
    },
  });
}
