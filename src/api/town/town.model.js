export default function (sequelize, DataTypes) {
  const Town = sequelize.define('Town', {
    _id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      validate: {
        notEmpty: true,
        len: [1, 50],
      },
    },
    location: {
      type: DataTypes.ARRAY(DataTypes.INTEGER),
      validate: {
        notEmpty: true,
        len: [2],
      },
      unique: true,
    },
    moneyPercent: {
      type: DataTypes.INTEGER,
    },
    resources: {
      type: DataTypes.JSON,
      // defaultValue: defaultResources
    },
    buildings: {
      type: DataTypes.JSON,
    },
    units: {
      type: DataTypes.JSON,
    },
  }, {
    hooks: {
      beforeCreate: town => {
        // Town.resources
        town.resources = {
          wood: 0,
          clay: 0,
          iron: 0,
        };
        town.buildings = {
          headquarters: 1,
          storage: 1,
          barracks: 0,
          wall: 0,
          woodcutter: 0,
          clayer: 0,
          ironer: 0,
        };
        town.units = {
          archer: 10,
        };
      },
    },
    classMethods: {
      getAvailableCoords: allCoords => {
        return Town.findAll({
          attributes: ['location'],
          where: {
            location: {
              $in: [...allCoords],
            },
          },
          raw: true,
        })
        .then(res => {
          const usedLocations = res.map(i => i.location.join(','));
          return allCoords.filter(c => !usedLocations.includes(c.join(',')));
        });
      },
    },
  });

  return Town;
}
