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
    production: {
      type: DataTypes.JSON,
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
          wood: 100,
          clay: 100,
          iron: 100,
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
        town.production = {
          clay: 5,
          wood: 5,
          iron: 5,
        };
        town.units = {
          archer: 10,
        };
      },
      // beforeUpdate: (town, options, cb) => {

      //   town.resources = town.updateRes(now);
      //   town.updatedAt = now;
      //   options.fields.push('updatedAt')
      //   options.silent = false;
      //   return cb(null, options);
      // },
    },
    instanceMethods: {
      // TODO: fix this, apparently, hooks already have updated data so can't get good updatedAt,
      // setting silent prevents updatedAt from updating even when doing so manually...
      updateRes: function (time) {
        const timePast = (time - new Date(this.updatedAt).getTime()) / 1000 / 60 / 60;
        this.resources.clay += this.production.clay * timePast;
        this.resources.wood += this.production.wood * timePast;
        this.resources.iron += this.production.iron * timePast;

        return this.resources;
      },
      /* Custom save, to update resources before updatedAt is changed
      because hooks don't allow this behavior :(.
      This is bad since save can occur later and set updatedAt to a different time than now...*/
      fullSave: function () {
        const now = Date.now();

        this.resources = this.updateRes(now);
        return this.save();
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
