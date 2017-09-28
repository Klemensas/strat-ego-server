import { main, world } from '../sqldb';

class WorldData {
  public world: any = {};
  public units = [];
  public unitMap = {};
  public buildings = [];
  public buildingMap: any = {};

  public readWorld(name) {
    return main.World.findOne({ where: { name }, raw: true })
      .then((config) => {
        this.world = config;
        return Promise.all([
          world.Building.findAll({ raw: true }),
          world.Unit.findAll({ raw: true }),
        ]);
      })
      .then(([buildings, units]: [any, any]) => {
        this.buildings = buildings;
        this.buildingMap = buildings.reduce((map, item) => {
          map[item.name] = item;
          return map;
        }, {});
        this.units = units;
        this.unitMap = units.reduce((map, item) => {
          map[item.name] = item;
          return map;
        }, {});
      })
      .catch((error) => console.log('Error read world.', error));
  }
}

export default new WorldData();
