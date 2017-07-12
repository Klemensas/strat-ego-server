import WorldData from './world';
import { world } from '../sqldb';
import { Town } from '../api/town/town.model';
const Town = world.Town;

export interface MapTown {
  _id: number;
  name: string;
  location: number[];
}

class MapManager {
  public mapData: { [name: string]: MapTown } = {};

  public addTown(town: Town) {
    // const owner = town
    this.mapData[town.location.join(',')] = {
      _id: town._id,
      name: town.name,
      location: town.location,
    };
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

  public chooseLocation() {
    world.Town.getAvailableCoords(this.getCoordsInRange(
      WorldData.world.generationArea,
      WorldData.world.currentRing,
      Math.ceil(WorldData.world.size / 2),
    ))
    .then((coords) => {
      console.log('available coords:', coords);
      return coords;
    })
    .then((coords) => coords[Math.round(Math.random() * (coords.length - 1))]);
  }
}

export default new MapManager();
