export default function(sequelize, DataTypes) {
  return sequelize.define('Restaurant', {
    _id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      validate: {
        notEmpty: true,
        len: [1, 50],
      }
    },
    location: {
      type: DataTypes.ARRAY(DataTypes.INTEGER),
      validate: {
        notEmpty: true,
        len: [2],
      },
      unique: true
    },
    moneyPercent: {
      type: DataTypes.INTEGER
    },
    resources: {
      type: DataTypes.JSON,
      // defaultValue: defaultResources
    },
    buildings: {
      type: DataTypes.JSON
    },
    kitchenWorkers: {
      type: DataTypes.JSON
    },
    outsideWorkers: {
      type: DataTypes.JSON
    }
  }, {
    hooks: {
      beforeCreate: function(restaurant) {
        // restaurant.resources
        restaurant.resources = {
          loyals: 20,
          money: 100,
          burgers: 100,
          fries: 100,
          drinks: 100
        };
        restaurant.buildings = {
          kitchen: 0
        };
      }
    }
  });

  // function defaultResources() {
  //   console.log(this);
  //   console.log('default res');
  // }
}