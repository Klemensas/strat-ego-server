import { World } from '../api/world/World.model';
import { Building } from '../api/world/Building.model';
import { Unit } from '../api/world/Unit.model';

class WorldData {
  public world: World;
  public units = [];
  public unitMap = {};
  public buildings = [];
  public buildingMap: any = {};

  public readWorld(name) {
    return World.findOne({ where: { name }, raw: true })
      .then((config) => {
        this.world = config;
        return Promise.all([
          Building.findAll({ raw: true }),
          Unit.findAll({ raw: true }),
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
