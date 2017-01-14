export default (sequelize, DataTypes) => sequelize.define('Message', {
  _id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true
  },
  content: {
    type: DataTypes.STRING,
    validate: {
      notEmpty: true,
      len: [10, 200],
    }
  }
});
