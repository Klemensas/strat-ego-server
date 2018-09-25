import * as Knex from 'knex';
import { Transaction } from 'objection';
import { Coords, Dict, TownProfile } from 'strat-ego-common';

import { WorldData } from '../world/worldData';
import { knexDb } from '../../sqldb';
import { getTownLocationsByCoords } from '../town/townQueries';
import { ProfileService } from '../profile/profileService';

export class MapManager {
  public mapData: Dict<number> = {};
  public world: string;
  public lastExpansion: number;
  public expansionRate: number;
  public expansionGrowth: number;
  public isExpanded: Promise<any> = Promise.resolve();
  public availableCoords: Coords[] = [];

  constructor(private worldData: WorldData) {}

  public async initialize() {
    ProfileService.townChanges.on('add', (payload) => this.addTown(payload));

    this.lastExpansion = +this.worldData.world.lastExpansion;
    this.expansionRate = +this.worldData.world.expansionRate;
    this.expansionGrowth = +this.worldData.world.expansionGrowth;
    await this.scheduleExpansion();

    const towns = await ProfileService.getTownProfile();
    this.addTown(...Object.values(towns));
  }

  public addTown(...towns: Array<Partial<TownProfile>>) {
    towns.forEach(({ id, location }) => this.mapData[location.toString()] = id);
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

    if (timeLeft > 0) {
      setTimeout(() => {
        this.isExpanded = this.scheduleExpansion();
      }, timeLeft);
      return;
    }

    await this.expandRing();

    return this.scheduleExpansion();
  }

  public async expandRing(trx?: Transaction | Knex) {
    await this.worldData.increaseRing(trx);
    this.lastExpansion = +this.worldData.world.lastExpansion;
    const ringCoords = this.getRingCoords(Math.ceil(this.worldData.world.size / 2), this.worldData.world.currentRing);
    const newCoords = [...ringCoords.top, ...ringCoords.right, ...ringCoords.bottom, ...ringCoords.left];
    const { coords, towns } = await this.worldData.townGrowth.generateRingTowns(newCoords, this.lastExpansion);
    ProfileService.addNpcTowns(towns);
    this.addTown(...towns);
    this.availableCoords = [...this.availableCoords, ...coords];
  }

  public async getAvailableCoords(coords: Coords[] = this.availableCoords) {
    const towns = await getTownLocationsByCoords(coords);
    const usedLocations = towns.map(({ location }) => location.join(','));
    return coords.filter((c) => !usedLocations.includes(c.join(',')));
  }
}
