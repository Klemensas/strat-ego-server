import { PlayerProfile, TownProfile, Dict } from 'strat-ego-common';

import { logger } from '../../logger';
import { ProfileService, ProfileChanges } from '../profile/profileService';

// TODO: consider using better data structure and better sorting
export class RankingService {
  public playerScores: { [id: number]: number } = {};
  public playerRankings: number[] = [];
  public lastUpdate = null;

  public get scores() {
    return this.playerRankings.map((id) => this.playerScores[id]);
  }

  public async initialize() {
    const playerProfiles = await ProfileService.getPlayerProfile();
    const playerIds = Object.keys(playerProfiles);
    this.playerScores = playerIds.reduce((result, key) => {
      result[key] = +playerProfiles[key].score;
      return result;
    }, {});
    this.playerRankings = playerIds
      .map((id) => +id);
    this.sortRankings(this.playerRankings, this.playerScores);

    ProfileService.townChanges.on('update', (payload) => this.updateTown(payload));
    ProfileService.playerChanges.on('add', (payload) => this.addPlayer(payload));
  }

  public updateTown({ current, prev, changes }: ProfileChanges<TownProfile>) {
    const changedPlayer = changes.hasOwnProperty('playerId');
    const changedScore = changes.hasOwnProperty('score');
    const playerOwned = current.hasOwnProperty('playerId') || prev.hasOwnProperty('playerId');

    if ((!changedScore && !changedPlayer) || !playerOwned ) { return; }

    this.lastUpdate = Date.now();
    if (changedPlayer) {
      // Reduce previous owner score
      if (prev.playerId !== null) {
        this.updatePlayerScore(prev.playerId, -prev.score);
      }
      // Increase new owner score
      if (current.playerId !== null) {
        this.updatePlayerScore(current.playerId, current.score);
      }
      return;
    }

    // Update player score by the change
    const scoreChange = current.score - prev.score;
    this.updatePlayerScore(current.playerId, scoreChange);
  }

  public addPlayer({ current }: ProfileChanges<PlayerProfile>) {
    this.playerScores[current.id] = current.score;
    this.playerRankings.push(current.id);
    this.playerRankings = this.addNewRankingItem(this.playerRankings, current.id, this.playerScores);
    this.lastUpdate = Date.now();
  }

  private updatePlayerScore(id: number, scoreChange: number) {
    const newList = this.generateNewList(this.playerRankings, id, this.playerScores, scoreChange);
    if (!newList) { return; }

    this.playerRankings = newList;
  }

  private generateNewList(list: number[], target: number, lookup: Dict<number>, change: number) {
    const newList = list.slice();
    const currentPosition = list.indexOf(target);
    if (currentPosition === -1) {
      logger.error('Ranking list missing target value', target);
      return null;
    }
    const newScore = lookup[target] + change;

    newList.splice(currentPosition, 1);
    let i = currentPosition - 1;
    if (change > 0) {
      while (i >= 0) {
        const value = lookup[newList[i]];
        if (value > newScore) { break; }
        if (value === newScore && newList[i] < target) { break; }
        i--;
      }
      i++;
    } else {
      while (i < newList.length) {
        const value = lookup[newList[i]];
        if (value < newScore) { break; }
        if (value === newScore && newList[i] > target) { break; }
        i++;
      }
    }

    // Position hasn't changed
    if (i === currentPosition) { return null; }

    newList.splice(i, 0, target);
    return newList;
  }

  private addNewRankingItem(list: number[], target: number, lookup: Dict<number>) {
    const newList = list.slice();
    newList.push(target);
    this.sortRankings(newList, lookup);
    return newList;
  }

  public sortRankings(list: number[], lookup: Dict<number>) {
    list.sort((a, b) => lookup[b] - lookup[a] || a - b);
  }

}

export const rankingService = new RankingService();
