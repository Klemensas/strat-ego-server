
import { Sequelize, Model, DataTypes, BelongsTo, HasMany, HasManyCreateAssociationMixin, Transaction } from 'sequelize';
import config from './config/environment';
const sequelize = new Sequelize(config.sequelize.main, config.sequelize.options);

class Test extends Model {
  public id: number;
  public test: number;
  public random: number;
}
Test.init({
  id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  test: {
    type: DataTypes.FLOAT,
  },
  random: {
    type: DataTypes.FLOAT,
  },
}, { sequelize });

Test.beforeValidate((test: Test) => {
  test.test = Math.random();
  test.changed('test', true);
});

let value;
Test.sync()
  .then(() => Test.create())
  .then((test: Test) => {
    test.random = Date.now();
    value = test.test;

    return test.update();
  })
  .then((test: Test) => test.reload())
  .then((test: Test) => {
    console.log('changed', test.test, value, value !== test.test);
  });
