import { PlayerProfile } from 'strat-ego-common';

import { logger } from '../../logger';
import { getPlayerRankings } from './playerQueries';

// TODO: consider using better data structure and better sorting
export class ScoreTracker {
  public playerScores: { [id: number]: PlayerProfile } = {};
  public rankings = [];
  public lastUpdate = null;

  public get scores() {
    return this.rankings.map((id) => this.playerScores[id]);
  }

  public async readScores() {
    try {
      const players: PlayerProfile[] = await getPlayerRankings();
      players.forEach((player) => {
        player.score = +(player.score || 0);
        this.playerScores[player.id] = player;
        this.rankings.push(player.id);
      });
      this.sortRankings();
    } catch (err) {
      logger.error(err, 'Error while readng scores');
      throw err;
    }
  }

  public updateScore(change: number, playerId: number) {
    if (!playerId || !this.playerScores[playerId]) { return; }
    this.playerScores[playerId].score += change;
    this.sortRankings();
  }

  public setScore(score: number, playerId: number) {
    if (!playerId || !this.playerScores[playerId]) { return; }
    this.playerScores[playerId].score = score;
    this.sortRankings();
  }

  public sortRankings() {
    this.rankings.sort((a, b) => +this.playerScores[b].score - +this.playerScores[a].score || this.playerScores[a].id - this.playerScores[b].id);
    this.lastUpdate = Date.now();
  }

  public addPlayer(player: PlayerProfile) {
    this.playerScores[player.id] = player;
    this.rankings.push(player.id);
    this.sortRankings();
  }
}

export const scoreTracker = new ScoreTracker();
