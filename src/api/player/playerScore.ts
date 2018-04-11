import { RankProfile } from 'strat-ego-common';

import { logger } from '../../logger';
import { knexDb } from '../../sqldb';
import { Player } from './player';
import { Town } from '../town/town';

// TODO: consider using better data structure and better sorting
class ScoreTracker {
  public playerScores: { [id: number]: RankProfile } = {};
  public rankings = [];
  public lastUpdate = null;

  public get scores() {
    return this.rankings.map((id) => this.playerScores[id]);
  }

  public async readScores(name: string) {
    try {
      const players: RankProfile[] = await Player.query(knexDb.world)
        .select(
          'id',
          'name',
          Player.relatedQuery('towns')
            .sum('score')
            .as('score'),
        ).orderBy('score', 'desc');
      players.forEach((player) => {
        player.score = player.score || 0;
        this.playerScores[player.id] = player;
        this.rankings.push(player.id);
      });
      this.sortRankings();
    } catch (err) {
      logger.error(err, 'Error while readng scores');
    }
  }

  public updateScore(change: number, playerId: number) {
    this.playerScores[playerId].score += change;
    this.sortRankings();
  }

  public sortRankings() {
    this.rankings.sort((a, b) => {
      const scoreDiff = +this.playerScores[b].score - +this.playerScores[a].score;
      return scoreDiff !== 0 ? scoreDiff : this.playerScores[a].id - this.playerScores[b].id;
    });
    this.lastUpdate = Date.now();
  }

  public addPlayer(player: RankProfile) {
    this.playerScores[player.id] = player;
    this.rankings.push(player.id);
    this.sortRankings();
  }
}

export const scoreTracker = new ScoreTracker();
