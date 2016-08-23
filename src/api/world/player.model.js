export default function(sequelize, DataTypes) {
  return sequelize.define('Player', {
    _id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    UserId: {
      primaryKey: true,
      type: DataTypes.INTEGER,
      allowNull: false
    }
  });
}
