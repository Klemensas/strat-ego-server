import { Transaction } from 'objection';
import * as Knex from 'knex';
import { EventEmitter } from 'events';

import { getPlayerProfiles } from '../player/playerQueries';
import { PlayerProfile, Dict, TownProfile, AllianceProfile } from 'strat-ego-common';
import { Player } from '../player/player';
import { Town } from '../town/town';
import { getTownProfiles } from '../town/townQueries';
import { getAllianceProfiles } from '../alliance/allianceQueries';
import { Alliance } from '../alliance/alliance';

export interface ProfileChanges<T> {
  current: T;
  prev: T;
  changes: Partial<T>;
}

type reduceFn<T, I> = (result: T, item: I) => T;
type profileQuery<T> = (ids?: number[], connection?: Transaction | Knex) => Promise<T[]>;

class ProfileService {
  public static playerProfiles: Dict<PlayerProfile> = {};
  public static townProfiles: Dict<TownProfile> = {};
  public static allianceProfiles: Dict<AllianceProfile> = {};
  public static playerChanges: EventEmitter = new EventEmitter();
  public static townChanges: EventEmitter = new EventEmitter();
  public static allianceChanges: EventEmitter = new EventEmitter();

  static async initialize() {
    return await Promise.all([
      this.getPlayerProfile(),
      this.getTownProfile(),
      this.getAllianceProfile(),
    ]).then(([playerProfiles, townProfiles, allianceProfiles]: [Dict<PlayerProfile>, Dict<TownProfile>, Dict<AllianceProfile>]) => {
      this.playerProfiles = playerProfiles;
      this.townProfiles = townProfiles;
      this.allianceProfiles = allianceProfiles;

      return {
        playerProfiles,
        townProfiles,
        allianceProfiles,
      };
    });
  }

  static getPlayerProfile(ids: number[] = []) {
    return this.getProfiles<PlayerProfile, Player>(this.playerProfiles, ids, getPlayerProfiles, this.playerProfileReducer);
  }

  static getTownProfile(ids: number[] = []) {
    return this.getProfiles<TownProfile, Town>(this.townProfiles, ids, getTownProfiles, this.townProfileReducer);
  }

  static getAllianceProfile(ids: number[] = []) {
    return this.getProfiles<AllianceProfile, Alliance>(this.allianceProfiles, ids, getAllianceProfiles, this.allianceProfileReducer);
  }

  static updatePlayerProfile(playerId: string | number, profile: Partial<PlayerProfile>, propagateChanges = true) {
    const prevProfile = { ...this.playerProfiles[playerId] };
    const newProfile = { ...prevProfile, ...profile };

    const changeType = prevProfile.hasOwnProperty(playerId) ? 'update' : 'add';
    this.playerChanges.emit(changeType, { prev: prevProfile, current: newProfile, changes: profile });
    if (!propagateChanges) { return newProfile; }

    if (profile.allianceId !== null) {
      if (prevProfile !== null) {
        const allianceProfile = this.allianceProfiles[prevProfile.allianceId];
        const members = allianceProfile.members.slice();
        const targetMember = members.findIndex(({ id }) => id === newProfile.id);
        members.splice(targetMember, 1);
        this.updateAllianceProfile(prevProfile.allianceId, { members }, false);
      }

      if (newProfile.allianceId !== null) {
        const allianceProfile = this.allianceProfiles[newProfile.allianceId];
        const members = allianceProfile.members.slice();
        members.push({ id: newProfile.id });
        this.updateAllianceProfile(newProfile.allianceId, { members }, false);
      }
    }
  }

  static updateTownProfile(townId: string | number, profile: Partial<TownProfile>, propagateChanges = true) {
    const prevProfile = { ...this.townProfiles[townId] };
    const newProfile = { ...prevProfile, ...profile };
    this.townProfiles[townId] = newProfile;

    const changeType = prevProfile.hasOwnProperty(townId) ? 'update' : 'add';
    this.townChanges.emit(changeType, { prev: prevProfile, current: newProfile, changes: profile });
    if (!propagateChanges) { return newProfile; }

    // Player changes
    if (profile.hasOwnProperty('playerId')) {
      if (prevProfile.playerId !== null) {
        const playerProfile = this.playerProfiles[prevProfile.playerId];
        const towns = playerProfile.towns.slice();
        const targetTown = towns.findIndex(({ id }) => id === newProfile.id);
        towns.splice(targetTown, 1);
        this.updatePlayerProfile(prevProfile.playerId, { towns }, false);
      }

      if (newProfile.playerId !== null) {
        const playerProfile = this.playerProfiles[newProfile.playerId];
        const towns = playerProfile.towns.slice();
        towns.push({ id: newProfile.id });
        this.updatePlayerProfile(newProfile.playerId, { towns }, false);
      }
    }
  }

  static updateAllianceProfile(id: string | number, profile: Partial<AllianceProfile>, propagateChanges = true) {
    const prevProfile = { ...this.allianceProfiles[id] };
    const newProfile = { ...prevProfile, ...profile };
    this.allianceProfiles[id] = newProfile;

    const changeType = prevProfile.hasOwnProperty(id) ? 'update' : 'add';
    this.allianceChanges.emit(changeType, { prev: prevProfile, current: newProfile, changes: profile });
    if (!propagateChanges) { return newProfile; }

    if (profile.members) {
      const change = this.compareChanges(newProfile.members, prevProfile.members);

      if (change.added.length) {
        const playerProfiles = this.getPlayerProfile(change.added);
        Object.keys(playerProfiles).forEach((playerId) => this.updatePlayerProfile(playerId, { allianceId: newProfile.id }, false));
      }

      if (change.removed.length) {
        const playerProfiles = this.getPlayerProfile(change.removed);
        Object.keys(playerProfiles).forEach((playerId) => this.updatePlayerProfile(playerId, { allianceId: null }, false));
      }
    }
  }

  static async deleteAllianceProfile(allianceId: number) {
    const allianceProfile = this.allianceProfiles[allianceId];
    allianceProfile.members.forEach(({ id }) => this.updatePlayerProfile(id, { allianceId: null }, false));
    delete this.allianceProfiles[allianceId];
    this.allianceChanges.emit('remove', { id: allianceId });
  }

  static addPlayerProfile(playerProfile: PlayerProfile, townProfile: TownProfile) {
    this.updatePlayerProfile(playerProfile.id, playerProfile, false);
    this.updateTownProfile(townProfile.id, townProfile, false);
  }

  static addNpcTowns(towns: Array<Partial<Town>>) {
    const townProfiles: Dict<TownProfile> = towns.reduce((result: Dict<TownProfile>, town) => {
      result[town.id] = {
        id: town.id,
        name: town.name,
        location: town.location,
        score: town.score,
        playerId: town.playerId,
        createdAt: town.createdAt,
      };
      return result;
    }, {});
    this.townProfiles = {
      ...this.townProfiles,
      ...townProfiles,
    };
  }

  private static async getProfiles<T, I>(allProfiles: Dict<T>, ids: number[], queryFn: profileQuery<I>, reducerFn: reduceFn<Dict<T>, I>) {
    let profiles: Dict<T>;
    if (!ids.length) {
      profiles = allProfiles;
    } else {
      profiles = ids.reduce((result, id) => {
        const profile = allProfiles[id];
        if (!profile) { return result; }

        result[id] = profile;
        return result;
      }, {});
    }

    const profileCount = Object.keys(profiles).length;
    // If any profiles are missing query the db
    if (!profileCount || profileCount < ids.length) {
      profiles = await this.fetchProfiles<T, I>(ids, queryFn, reducerFn);
      allProfiles = { ...allProfiles, ...profiles};
    }
    return profiles;
  }

  private static async fetchProfiles<T, I>(ids: number[], queryFn: profileQuery<I>, reducerFn: reduceFn<Dict<T>, I>) {
    const profileList = await queryFn(ids);
    return profileList.reduce(reducerFn, {});
  }

  private static playerProfileReducer(result: Dict<PlayerProfile>, player: Player): Dict<PlayerProfile> {
    result[player.id] = {
      id: player.id,
      name: player.name,
      towns: player.towns,
      score: player.score,
      allianceId: player.allianceId,
      description: player.description,
      avatarUrl: player.avatarUrl,
      createdAt: player.createdAt,
    };
    return result;
  }

  private static townProfileReducer(result: Dict<TownProfile>, town: Town): Dict<TownProfile> {
    result[town.id] = {
      id: town.id,
      name: town.name,
      location: town.location,
      score: town.score,
      playerId: town.playerId,
      createdAt: town.createdAt,
    };
    return result;
  }

  private static allianceProfileReducer(result: Dict<AllianceProfile>, alliance: Alliance): Dict<AllianceProfile> {
    console.log('see', alliance.members);
    const { members, score } = alliance.members.reduce((items: { score: number, members: Array<Partial<PlayerProfile>> }, player) => {
      items.score += player.score;
      items.members.push({ id: player.id });
      return items;
    }, { score: 0, members: [] });
    result[alliance.id] = {
      id: alliance.id,
      name: alliance.name,
      score,
      members,
      description: alliance.description,
      avatarUrl: alliance.avatarUrl,
      createdAt: alliance.createdAt,
    };
    return result;
  }

  private static compareChanges(newList: Array<{ id: number & any}>, prevList: Array<{ id: number & any}> = []): { added: number[], removed: number[] } {
    const newIdArray = newList.map(({ id }) => id);
    return newList.reduce((result, { id }) => {
      const townIndex = prevList.findIndex((prevItem) => prevItem.id === id);
      if (townIndex === -1) {
        result.added.push(id);
      } else {
        result.removed.splice(townIndex, 1);
      }
      return result;
    }, { added: [], removed: [...newIdArray] });
  }
}

export { ProfileService };
