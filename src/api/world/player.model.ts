import { Sequelize } from 'sequelize';

export default (sequelize: Sequelize, DataTypes) => sequelize.define('Player', {
  _id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  UserId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  hooks: {
    beforeBulkCreate: () => {
      return null;
    },
  },
});
