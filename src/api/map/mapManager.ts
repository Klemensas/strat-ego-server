import * as Knex from 'knex';
import { MapTown, Coords, Profile, Map } from 'strat-ego-common';

import { Town } from '../town/town';
import { Player } from '../player/player';
import { World } from '../world/world';
import { logger } from '../../logger';
import { Alliance } from '../alliance/alliance';
import { worldData } from '../world/worldData';
import { knexDb } from '../../sqldb';

export class MapManager {
  public mapData: Map = {};
  public world: string;
  public lastExpansion: number;
  public expansionRate: number;
  public expansionGrowth: number;
  public availableCoords: Coords[];
  constructor(private worldData: WorldData) {}

  public async initialize(world: string) {
    this.world = world;
    this.lastExpansion = +this.worldData.world.lastExpansion;
    this.expansionRate = +this.worldData.world.expansionRate;
    this.expansionGrowth = +this.worldData.world.expansionGrowth;
    const towns = await Town
      .query(knexDb.world)
      .eager('[player, player.alliance]')
      .pick(Player, ['id', 'name'])
      .pick(Alliance, ['id', 'name']);
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
      this.mapData[target[0]].alliance = alliance;
    });
   }

  public setTownScore(score: number, coords: Coords) {
    this.mapData[coords.join(',')].score = score;
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

  public async chooseLocation(trx: Knex.Transaction | Knex = knexDb.main): Promise<Coords> {
    const coords = await Town.getAvailableCoords(this.getCoordsInRange(
      worldData.world.generationArea,
      worldData.world.currentRing,
      Math.ceil(worldData.world.size / 2),
    ));
    // TODO: better handling running out of locations
    if (!coords.length) {
      await worldData.increaseRing(this.world, trx);
      return this.chooseLocation(trx);
    }
    logger.info('available coords:', coords, coords[Math.round(Math.random() * (coords.length - 1))]);
    return coords[Math.round(Math.random() * (coords.length - 1))];
  }

  public getAllData() {
    return this.mapData;
  }
  public async expandRing(trx?: Transaction | Knex) {
    await this.worldData.increaseRing(this.world, trx);
    this.lastExpansion = +this.worldData.world.lastExpansion;
  }

  public async getAvailableCoords(coords: Coords[]) {
    // knex requires wrapping in an array http://knexjs.org/#Raw-Bindings
    const wrappedCoords: any = coords.map((item) => ([item]));
    const towns = await Town
      .query(knexDb.world)
      .select('location')
      .whereIn('location', wrappedCoords);
    const usedLocations = towns.map(({ location }) => location.join(','));
    return coords.filter((c) => !usedLocations.includes(c.join(',')));
  }
}

export const mapManager = new MapManager(worldDataInstance);
