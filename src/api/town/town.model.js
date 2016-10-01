import { socket } from '../../app';
import { activeWorlds } from '../../components/worlds';

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
    production: {
      type: DataTypes.JSON,
    },
    resources: {
      type: DataTypes.JSON,
      validate: {
        isPositive: function (resources) {
          const invalid = Object.keys(resources).some(i => resources[i] < 0);
          if (invalid) {
            throw new Error('Not enough resources. Last updated at ', this.updatedAt);
          }
        },
      },
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
        const world = activeWorlds.get('megapolis');
        const buildings = world.buildingData.reduce((map, item) => {
          map[item.name] = { level: item.levels.min, queued: 0 };
          return map;
        }, {});
        const units = world.unitData.reduce((map, item) => {
          map[item.name] = { amount: 0, queued: 0 };
          return map;
        }, {});

        // Town.resources
        town.resources = {
          wood: 800,
          clay: 800,
          iron: 800,
        };
        town.buildings = buildings;
        town.production = town.calculateProduction();
        town.units = units;
      },
      beforeUpdate: town => {
        town.resources = town.updateRes(town.updatedAt, town._previousDataValues.updatedAt);

        // Recalculate production if buildings updated
        if (town.changed('buildings')) {
          town.production = town.calculateProduction();

        }
      },
      afterUpdate: town => {
        town.getBuildingQueues()
          .then(queues => {
            town.setDataValue('BuildingQueues', queues);
            socket.sockets.in(town._id).emit('town', town);
          })
      }
    },
    instanceMethods: {
      // TODO: fix this, apparently, hooks already have updated data so can't get good updatedAt,
      // setting silent prevents updatedAt from updating even when doing so manually...
      updateRes(now, previous = this.updatedAt) {
        const timePast = (now - new Date(previous).getTime()) / 1000 / 60 / 60;
        this.resources.clay += this.production.clay * timePast;
        this.resources.wood += this.production.wood * timePast;
        this.resources.iron += this.production.iron * timePast;

        return this.resources;
      },
      calculateProduction() {
        const world = activeWorlds.get('megapolis');
        const buildingData = world.buildingDataMap;
        return {
          wood: world.baseProduction + buildingData.wood.data[this.buildings.wood.level].production,
          clay: world.baseProduction + buildingData.clay.data[this.buildings.clay.level].production,
          iron: world.baseProduction + buildingData.iron.data[this.buildings.iron.level].production,
        }
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
