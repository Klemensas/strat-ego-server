import { main, world } from '../sqldb';

let worldData = {};

export const readWorld = targetWorld => {
  const World = main.World;
  const Building = world.Building;
  const Unit = world.Unit;

  return World.findOne({ where: { name: targetWorld }, raw: true })
    .then(worldConfig => {
      worldData.config = worldConfig;
      return Promise.all([
        Building.findAll({ raw: true }),
        Unit.findAll({ raw: true })
      ]);
    })
    .then(objects => {
      const buildings = objects[0];
      const units = objects[0];
      worldData.buildings = buildings;
      worldData.buildingMap = buildings.reduce((map, item) => {
        map[item.name] = item;
        return map;
      }, {});
      worldData.units = units;
      worldData.unitMap = units.reduce((map, item) => {
        map[item.name] = item;
        return map;
      }, {});
      return worldData;
    })
    .catch(err => console.log(`Error in world read: ${err}`));
};

export default worldData;
