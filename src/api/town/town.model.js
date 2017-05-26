import { io } from '../../app';
import worldData from '../../components/worlds';
import mapData from '../../config/game/map';
import { resolveAttack, resolveReturn, resolveSupport } from './components/movement.resolver';

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
    loaylty: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 100,
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
      type: DataTypes.JSONB,
    },
    units: {
      type: DataTypes.JSONB,
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
        // Update res if not marked as changed
        console.log('res update', town.changed('resources'))
        if (!town.changed('resources')) {
          town.updateRes(town.updatedAt, town.previous('updatedAt'));
        }
        // Recalculate production if buildings updated
        if (town.changed('buildings')) {
          town.production = town.calculateProduction();
        }
      },
      // afterUpdate: town => {
      //   town.getBuildingQueues()
      //     .then(queues => {
      //       town.setDataValue('BuildingQueues', queues);
      //       console.log(`Town ${town._id} updated, sending data to sockets`);
      //     });
      // },
      afterCreate: town => {
        town.reload({ include: [{ all: true }] })
          .then(fullTown => mapData.addTown(fullTown));
      },
    },
    instanceMethods: {
      notifySave(event, transaction) {
        console.log('hello i notify')
        return this.save({ transaction })
          .then(town => town.reload({ include: [{ all: true }] }))
          .then(town => {
            console.log('reloaded fully', town.dataValues)
            io.sockets.in(town._id).emit('town', { town, event });
            return town;
          });
      },
      notify(event) {
        return this.reload({ include: [{ all: true }] })
          .then(town => io.sockets.in(town._id).emit('town', { town, event }));
      },
      // TODO: fix this, apparently, hooks already have updated data so can't get good updatedAt,
      // setting silent prevents updatedAt from updating even when doing so manually...
      updateRes(now, previous = this.updatedAt) {
        const timePast = (now - new Date(previous).getTime()) / 1000 / 60 / 60;
        const maxRes = this.getMaxRes();
        const clay = this.resources.clay + this.production.clay * timePast;
        const wood = this.resources.wood + this.production.wood * timePast;
        const iron = this.resources.iron + this.production.iron * timePast;
        this.resources = {
          clay: Math.min(maxRes, clay),
          wood: Math.min(maxRes, wood),
          iron: Math.min(maxRes, iron),
        };
        return this;
      },
      calculateProduction() {
        const buildingData = worldData.buildingMap;
        return {
          wood: worldData.config.baseProduction + buildingData.wood.data[this.buildings.wood.level].production,
          clay: worldData.config.baseProduction + buildingData.clay.data[this.buildings.clay.level].production,
          iron: worldData.config.baseProduction + buildingData.iron.data[this.buildings.iron.level].production,
        };
      },
      getLastQueue(queue) {
        return this[queue].sort((a, b) => b.endsAt.getTime() - a.endsAt.getTime())[0];
      },
      checkBuildingRequirements(requirements) {
        return requirements ?
          requirements.every(({ item, level }) => this.buildings[item].level >= level) :
          true;
      },
      getMaxRes() {
        return worldData.buildingMap.storage.data[this.buildings.storage.level].storage;
      },
      getWallBonus() {
        return worldData.buildingMap.wall.data[this.buildings.wall.level].defense || 1;
      },
      getRecruitmentModifier() {
        return worldData.buildingMap.barracks.data[this.buildings.barracks.level].recruitment
      },
      getAvailablePopulation() {
        const used = worldData.units.reduce((total, unit) => {
          return total + Object.values(this.units[unit.name]).reduce((a, b) => a + b);
        }, 0);
        const total = worldData.buildingMap.farm.data[this.buildings.farm.level].population;
        return total - used;
      },
      processQueues() {
        const doneBuildings = [];
        const doneUnits = [];
        this.BuildingQueues.forEach(queue => {
          const building = this.buildings[queue.building];
          building.level++;
          if (building.queued === building.level) {
            building.queued = 0;
          }
          doneBuildings.push(queue._id);
        });
        this.UnitQueues.forEach(queue => {
          const unit = this.units[queue.unit];
          unit.inside += queue.amount;
          unit.queued -= queue.amount;
          doneUnits.push(queue._id);
        });
        return this.resolveAllMovements().then(town => {
        // trigger change manully, because sequalize can't detect it
          console.log('hmmz', town)
          console.log('waawaw', town.changed)
          if (doneBuildings.length) {
            town.changed('buildings', true);
          }
          town.changed('units', true);
          town.doneBuildings = doneBuildings;
          town.doneUnits = doneUnits;
          return town;
        });
      },
      resolveAllMovements() {
        if (this.MovementDestinationTown.length) {
          const movement = this.MovementDestinationTown.shift();
          return Town.resolveMovement(movement, this)
            .then(() => Town.findById(this._id, { include: [{ all: true }] }))
            .then(town => {
              if (town.MovementDestinationTown.length) {
                return town.resolveAllMovements();
              }
              return town;
            });
        } else if (this.MovementOriginTown.length) {
          const movement = this.MovementOriginTown.shift();
          return Town.findById(movement.MovementDestinationId)
            .then(town => Town.resolveMovement(movement, town))
            .then(() => Town.findById(this._id, { include: [{ all: true }] }))
            .then(town => {
              if (town.MovementOriginTown.length) {
                return town.resolveAllMovements();
              }
              return town;
            });
        }
        return Promise.resolve(this);
      }
    },
    classMethods: {
      resolveMovement: function movementResolver(movement, destinationTown) {
        let resolver = null;
        switch (movement.type) {
          case 'attack':
            resolver = resolveAttack;
            break;
          case 'return':
            resolver = resolveReturn;
            break;
          case 'support':
            resolver = resolveSupport;
            break;
        }
        console.log('hmmm', movement.type, movement.units, destinationTown)
        console.log('attempting to resolve', movement.type, movement.units, destinationTown.dataValues.units)
        return resolver(movement, destinationTown);
      },
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
      offsetToCube: (coords) => {
        const off = 1;
        const x = coords[0] - Math.trunc((coords[1] + off * (coords[1] % 2)) / 2);
        const z = coords[1];
        return {
          x, z,
          y: -x - z
        }
      },
      calculateDistance: (originCoords, targetCoords) => {
      const origin = Town.offsetToCube(originCoords);
      const target = Town.offsetToCube(targetCoords);
        return Math.max(
          Math.abs(origin.x - target.x),
          Math.abs(origin.y - target.y),
          Math.abs(origin.z - target.z)
        );
      },
    },
  });

  return Town;
}
