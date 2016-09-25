import { socket } from '../../app';
import { world } from '../../sqldb';

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
        // Town.resources
        town.resources = {
          wood: 100,
          clay: 100,
          iron: 100,
        };
        town.buildings = {
          headquarters: { level: 1, queued: 0 },
          storage: { level: 1, queued: 0 },
          barracks: { level: 0, queued: 0 },
          wall: { level: 0, queued: 0 },
          woodcutter: { level: 0, queued: 0 },
          clayer: { level: 0, queued: 0 },
          ironer: { level: 0, queued: 0 },
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
      beforeUpdate: town => {
        town.resources = town.updateRes(town.updatedAt, town._previousDataValues.updatedAt);
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
      updateRes: function (now, previous = this.updatedAt) {
        const timePast = (now - new Date(previous).getTime()) / 1000 / 60 / 60;
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
