import * as Knex from 'knex';
import { Transaction } from 'objection';
import { MapTown, Coords, Profile, Dict } from 'strat-ego-common';

import { Town } from '../town/town';
import { Player } from '../player/player';
import { World } from '../world/world';
import { logger } from '../../logger';
import { Alliance } from '../alliance/alliance';
import { worldData as worldDataInstance, WorldData } from '../world/worldData';
import { knexDb } from '../../sqldb';
import { getTownLocationsByCoords, getTownsMapProfile } from '../town/townQueries';

export class MapManager {
  public mapData: Dict<MapTown> = {};
  public world: string;
  public lastExpansion: number;
  public expansionRate: number;
  public expansionGrowth: number;
  public isExpanded: Promise<any> = Promise.resolve();
  public availableCoords: Coords[] = [];

  constructor(private worldData: WorldData) {}

  public async initialize() {
    this.lastExpansion = +this.worldData.world.lastExpansion;
    this.expansionRate = +this.worldData.world.expansionRate;
    this.expansionGrowth = +this.worldData.world.expansionGrowth;
    await this.scheduleExpansion();

    const towns = await getTownsMapProfile();
    this.addTown(...towns);
  }

  public addPlayerTowns(player: Partial<Player>) {
    const owner = {
      id: player.id,
      name: player.name,
    };
    const alliance = player.alliance ? {
      id: player.alliance.id,
      name: player.alliance.name,
    } : null;
    player.towns.forEach((town) => {
      this.mapData[town.location.join(',')] = {
        owner,
        alliance,
        id: town.id,
        name: town.name,
        location: town.location,
        score: town.score,
      };
    });
  }

  public addTown(...towns: Array<Partial<Town>>) {
     towns.forEach((town) => {
      let owner = null;
      let alliance = null;

      if (town.player) {
        owner = town.player ? {
          id: town.player.id,
          name: town.player.name,
        } : null;
        alliance = town.player.alliance ? {
          id: town.player.alliance.id,
          name: town.player.alliance.name,
        } : null;
      }
      this.mapData[town.location.join(',')] = {
        owner,
        alliance,
        id: town.id,
        name: town.name,
        location: town.location,
        score: town.score,
      };
     });
   }

  //  TODO: finding might be painful here, consider a different approach
  public setTownAlliance(alliance: Profile, townIds: number[]) {
    const townList = Object.entries(this.mapData);
    townIds.forEach((id) => {
      const target = townList.find(([key, data]) => data.id === id);
      if (target) {
        this.mapData[target[0]].alliance = alliance;
      }
    });
   }

  public setTownScore(score: number, coords: Coords) {
    const target = this.mapData[coords.join(',')];
    if (target) {
      target.score = score;
    }
  }

  public getRingCoords(size: number, ring: number) {
    const min = size - ring;
    const max = size + ring;
    const halfRing = Math.floor(ring / 2);

    const xLeft: Coords = [min, size];
    const xRight: Coords = [max, size];
    const top: Coords[] = [];
    const bottom: Coords[] = [];
    const leftTop: Coords[] = [];
    const leftBottom: Coords[] = [];
    const rightTop: Coords[] = [];
    const rightBottom: Coords[] = [];

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

  public getCoordsInRange(rings: number, furthestRing: number, size: number): Coords[] {
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

  public async chooseLocation(trx: Transaction | Knex = knexDb.main): Promise<Coords> {
    await this.isExpanded;
    if (!this.availableCoords.length) {
      await this.expandRing(trx);
      return this.chooseLocation(trx);
    }
    const coord = this.availableCoords.splice(Math.floor(Math.random() * this.availableCoords.length), 1);
    return coord[0];
  }

  public getAllData() {
    return this.mapData;
  }

  // TODO: consider making expansion smarter to take into account distance from current towns
  public async scheduleExpansion() {
    const nextExpansion = +this.lastExpansion + Math.floor(this.expansionGrowth ** this.worldData.world.currentRing * this.expansionRate);
    const timeLeft = nextExpansion - Date.now();

    if (timeLeft <= 0) {
      await this.expandRing();
      return this.scheduleExpansion();
    }

    setTimeout(() => {
      this.isExpanded = this.scheduleExpansion();
    }, timeLeft);

    const coords = await this.getAvailableCoords(this.getCoordsInRange(
      this.worldData.world.generationArea,
      this.worldData.world.currentRing,
      Math.ceil(this.worldData.world.size / 2),
    ));
    this.availableCoords = coords;
  }

  public async expandRing(trx?: Transaction | Knex) {
    await this.worldData.increaseRing(this.world, trx);
    this.lastExpansion = +this.worldData.world.lastExpansion;
  }

  public async getAvailableCoords(coords: Coords[]) {
    // knex requires wrapping in an array http://knexjs.org/#Raw-Bindings
    const towns = await getTownLocationsByCoords(coords);
    const usedLocations = towns.map(({ location }) => location.join(','));
    return coords.filter((c) => !usedLocations.includes(c.join(',')));
  }
}

export const mapManager = new MapManager(worldDataInstance);
