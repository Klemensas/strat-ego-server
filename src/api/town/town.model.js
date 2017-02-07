import { io } from '../../app';
import worldData from '../../components/worlds';
import mapData from '../../config/game/map';

export default (sequelize, DataTypes) => {
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
      defaultValue: 'Abandoned Town',
    },
    location: {
      type: DataTypes.ARRAY(DataTypes.INTEGER),
      allowNull: false,
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
            throw new Error('Resources can\'t be negative. Last updated at ', this.updatedAt);
          }
        },
      },
    },
    buildings: {
      type: DataTypes.JSON,
    },
    units: {
      type: DataTypes.JSON,
      validate: {
        isPositive: function (units) {
          const invalid = Object.keys(units).some(i => units[i].inside < 0 || units[i].outside < 0);
          if (invalid) {
            throw new Error('Units can\'t be negative. Last updated at ', this.updatedAt);
          }
        },
      },
    },
  }, {
    hooks: {
      beforeBulkCreate: towns => {
        const buildings = worldData.buildings.reduce((map, item) => {
          map[item.name] = { level: item.levels.min, queued: 0 };
          return map;
        }, {});
        const units = worldData.units.reduce((map, item) => {
          map[item.name] = { inside: 0, outside: 0, queued: 0 };
          return map;
        }, {});
        const resources = {
          wood: 800,
          clay: 800,
          iron: 800,
        };
        return towns.map(town => {
          town.buildings = buildings;
          town.units = units;
          town.resources = resources;
          town.production = town.calculateProduction();
          return town;
        });
      },
      beforeCreate: town => {
        const buildings = worldData.buildings.reduce((map, item) => {
          map[item.name] = { level: item.levels.min, queued: 0 };
          return map;
        }, {});
        const units = worldData.units.reduce((map, item) => {
          map[item.name] = { inside: 0, outside: 0, queued: 0 };
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
        town.resources = town.updateRes(town.updatedAt, town.previous('updatedAt'));

        // Recalculate production if buildings updated
        if (town.changed('buildings')) {
          town.production = town.calculateProduction();
        }
      },
      afterUpdate: town => {
        town.getBuildingQueues()
          .then(queues => {
            town.setDataValue('BuildingQueues', queues);
            io.sockets.in(town._id).emit('town', town);
          });
      },
      afterCreate: town => {
        town.reload({ include: [{ all: true }] })
          .then(fullTown => mapData.addTown(fullTown));
      },
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
        const buildingData = worldData.buildingMap;
        return {
          wood: worldData.config.baseProduction + buildingData.wood.data[this.buildings.wood.level].production,
          clay: worldData.config.baseProduction + buildingData.clay.data[this.buildings.clay.level].production,
          iron: worldData.config.baseProduction + buildingData.iron.data[this.buildings.iron.level].production,
        };
      },
    },
    classMethods: {
      getAvailableCoords: allCoords =>
        Town.findAll({
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
        }),
      processQueues: town => {
        town.doneBuildings = [];
        town.doneUnits = [];
        town.BuildingQueues.forEach(queue => {
          const building = town.buildings[queue.building];
          building.level++;
          if (building.queued === building.level) {
            building.queued = 0;
          }
          town.doneBuildings.push(queue._id);
        });
        town.UnitQueues.forEach(queue => {
          const unit = town.units[queue.unit];
          unit.amount += queue.amount;
          unit.queued -= queue.amount;
          town.doneUnits.push(queue._id);
        });

        // trigger change manully, because sequalize can't detect it
        if (town.doneBuildings.length) {
          town.changed('buildings', true);
        }
        if (town.doneUnits.length) {
          town.changed('units', true);
        }

        return town;
      }
    },
  });

  return Town;
}
