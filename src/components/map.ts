import * as Bluebird from 'bluebird';
import { Town } from '../api/town/town.model';
import { Player } from '../api/world/player.model';
import { World } from '../api/world/world.model';
import { logger } from '../';
import { Alliance } from '../api/alliance/alliance.model';
import { worldData } from '../api/world/worldData';

export interface MapTown {
  id: number;
  name: string;
  location: number[];
  owner: {
    id: number;
    name: string;
  };
  alliance: {
    id: number;
    name: string;
  };
}

class MapManager {
  public mapData: { [name: string]: MapTown } = {};
  public world: string;

  public initialize(world: string) {
    this.world = world;
    return Town.findAll({
      include: [{
        model: Player,
        as: 'Player',
        attributes: ['id', 'name'],
        include: [{
          model: Alliance,
          as: 'Alliance',
          attributes: ['id', 'name'],
        }],
      }],
    })
      .then((towns) => this.addTown(...towns));
  }

  public addTown(...towns) {
     towns.forEach((town) => {
      let owner = null;
      let alliance = null;

      if (town.Player) {
        owner = town.Player ? {
          id: town.Player.id,
          name: town.Player.name,
        } : null;
        alliance = town.Player.Alliance ? {
          id: town.Player.Alliance.id,
          name: town.Player.Alliance.name,
        } : null;
      }
      this.mapData[town.location.join(',')] = {
        id: town.id,
        name: town.name,
        owner,
        alliance,
        location: town.location,
      };
     });
   }

  public getRingCoords(size, ring) {
    const min = size - ring;
    const max = size + ring;
    const halfRing = Math.floor(ring / 2);

    const xLeft = [min, size];
    const xRight = [max, size];
    const top = [];
    const bottom = [];
    const leftTop = [];
    const leftBottom = [];
    const rightTop = [];
    const rightBottom = [];

    for (let i = 0; i < ring + 1; i++) {
      const x = min + halfRing + i;
      top.push([x, min]);
      bottom.push([x, max]);
      if (i < ring - 1) {
        const yT = size - 1 - i;
        const yB = size + 1 + i;
        const xL = min + Math.floor((i + 1) / 2);
        const xR = max - Math.round((1 + i) / 2);
        leftTop.unshift([xL, yT]);
        rightTop.unshift([xR, yT]);
        leftBottom.push([xL, yB]);
        rightBottom.push([xR, yB]);
      }
    }

    return {
      left: [...leftTop, xLeft, ...leftBottom],
      right: [...rightTop, xRight, ...rightBottom],
      top,
      bottom,
    };
  }

  public getCoordsInRange(rings, furthestRing, size) {
    const coords = this.getRingCoords(size, furthestRing);
    const innards = coords.left.reduce((p, c, i, a) => {
      const right = coords.right[i];
      if (i >= rings - 1 && i <= a.length - rings) {
        return [
          ...p,
          ...Array.from({ length: rings }, (v, j) => [c[0] + j, c[1]]),
          ...Array.from({ length: rings }, (v, j) => [right[0] - j, right[1]]),
        ];
      }
      const rowLength = right[0] - c[0] + 1;
      return [
        ...p,
        ...Array.from({ length: rowLength }, (v, j) => [c[0] + j, c[1]]),
      ];
    }, []);
    return [...coords.top, ...innards, ...coords.bottom];
  }

  public chooseLocation(): Bluebird<[number, number]> {
    return Town.getAvailableCoords(this.getCoordsInRange(
      worldData.world.generationArea,
      worldData.world.currentRing,
      Math.ceil(worldData.world.size / 2),
    ))
    .then((coords) => {
      if (!coords.length) {
        return worldData.increaseRing(this.world)
          .then(() => this.chooseLocation());
      }
      // TODO: handle running out of locationsx`
      logger.info('available coords:', coords, coords[Math.round(Math.random() * (coords.length - 1))]);
      return coords[Math.round(Math.random() * (coords.length - 1))];
    });
  }

  public getAllData() {
    return this.mapData;
  }
}

export default new MapManager();
