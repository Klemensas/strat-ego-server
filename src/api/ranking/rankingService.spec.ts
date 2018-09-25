import { RankingService } from './rankingService';
import { logger } from '../../logger';
import { Player } from '../player/player';
import { worldData } from '../world/worldData';
import { World } from '../world/world';
import * as playerQueries from '../player/playerQueries';

const examplePlayers = {
  1: {
    id: 1,
    name: 'Player #1',
    score: 0,
  },
  2: {
    id: 2,
    name: 'Player #2',
    score: 5,
  },
  3: {
    id: 3,
    name: 'Player #3',
    score: 66,
  },
};
const players = [{
  name: 'test #1',
  userId: 1,
  towns: [{
    location: [1, 1],
    score: 5,
  }, {
    location: [1, 2],
    score: 2,
  }],
}, {
  name: 'test #2',
  userId: 2,
  towns: [{
    location: [1, 3],
    score: 44,
  }, {
    location: [1, 4],
    score: 2,
  }],
}, {
  name: 'test #3',
  userId: 3,
}] as Player[];

const exampleRankings = Object.values(examplePlayers).map((player) => player.id);
beforeAll(() => {
  worldData.world = {
    baseProduction: 0,
  } as World;
});

let rankingService: RankingService;
beforeEach(() => {
  rankingService = new RankingService();
  rankingService.playerScores = { ...examplePlayers };
  rankingService.playerRankings = exampleRankings.slice();
});

it('should initially have empty values', () => {
  const freshService = new RankingService();
  expect(freshService.playerScores).toEqual({});
  expect(freshService.playerRankings).toEqual([]);
  expect(freshService.lastUpdate).toEqual(null);
});

it('scores should return ranking value populated with playerScores in order', () => {
  expect(rankingService.scores).toEqual(Object.values(examplePlayers));

  rankingService.playerRankings.sort((a, b) => rankingService.playerScores[b].score - rankingService.playerScores[a].score);
  expect(rankingService.scores).not.toEqual(Object.values(examplePlayers));

  rankingService.playerRankings = [];
  expect(rankingService.scores).toEqual([]);
});

describe('readScores', () => {
  const dbPlayers = players.map((player) => ({
    id: player.id,
    name: player.name,
    score: player.towns && player.towns.length ? player.towns.reduce((s, t) => s + t.score, 0) : null,
  }));
  beforeEach(() => {
    rankingService = new RankingService();
    jest.spyOn(playerQueries, 'getPlayerRankings').mockImplementation(() => Promise.resolve(dbPlayers));
  });

  it('should set all player scores', async () => {
    const sortSpy = jest.spyOn(rankingService, 'sortRankings');
    await rankingService.readScores();
    const expectedPlayers = dbPlayers.reduce((result, item) => ({
      ...result,
      [item.id]: {
        ...item,
        score: item.score || 0,
      },
    }), {});
    expect(rankingService.sortRankings).toHaveBeenCalledTimes(1);
    expect(rankingService.rankings).toHaveLength(players.length);
    expect(rankingService.playerScores).toEqual(expectedPlayers);
  });
});

it('readScores on error should log and rethrow', async () => {
  const expectedError = 'error';
  const knexSpy = jest.spyOn(playerQueries, 'getPlayerRankings').mockImplementationOnce(() => Promise.reject(expectedError));
  const loggerSpy = jest.spyOn(logger, 'error');
  loggerSpy.mockImplementation(() => null);

  let error;
  try {
    await rankingService.readScores();
  } catch (err) {
    error = err;
  }
  expect(error).toEqual(expectedError);
  expect(loggerSpy).toHaveBeenCalled();
});

describe('setScore', () => {
  it('should set target player score', () => {
    let targetPlayer = examplePlayers[exampleRankings[0]];
    let expectedScore = 555;

    rankingService.setScore(expectedScore, targetPlayer.id);
    expect(rankingService.playerScores[targetPlayer.id].score).toEqual(expectedScore);

    targetPlayer = examplePlayers[exampleRankings[1]];
    expectedScore = 1;

    rankingService.setScore(expectedScore, targetPlayer.id);
    expect(rankingService.playerScores[targetPlayer.id].score).toEqual(expectedScore);
  });

  it('should sortRankings on set', () => {
    const sortSpy = jest.spyOn(rankingService, 'sortRankings');

    rankingService.setScore(1, rankingService.rankings[0]);
    expect(sortSpy).toHaveBeenCalledTimes(1);
  });
});

describe('updateScore', () => {
  it('should update target player score', () => {
    let scoreChange = 10;
    let targetPlayer = examplePlayers[exampleRankings[0]];
    let expectedScore = targetPlayer.score + scoreChange;

    rankingService.updateScore(scoreChange, targetPlayer.id);
    expect(rankingService.playerScores[targetPlayer.id].score).toEqual(expectedScore);

    scoreChange = -10;
    targetPlayer = examplePlayers[exampleRankings[1]];
    expectedScore = targetPlayer.score + scoreChange;

    rankingService.updateScore(scoreChange, targetPlayer.id);
    expect(rankingService.playerScores[targetPlayer.id].score).toEqual(expectedScore);
  });

  it('should sortRankings on update', () => {
    const sortSpy = jest.spyOn(rankingService, 'sortRankings');

    rankingService.updateScore(1, rankingService.rankings[0]);
    expect(sortSpy).toHaveBeenCalledTimes(1);
  });
});

describe('sortRankings', () => {
  it('should sort by score and id', () => {
    expect(rankingService.rankings).toEqual(exampleRankings);

    const descendingIds = [44, 4];
    const playerScores = { ...examplePlayers };
    const matchingScore = 12;
    playerScores[descendingIds[0]] = {
      id: descendingIds[0],
      player: `Player #${descendingIds[0]}`,
      score: matchingScore,
    };
    playerScores[descendingIds[1]] = {
      id: descendingIds[1],
      player: `Player #${descendingIds[1]}`,
      score: matchingScore,
    };

    const rankings = exampleRankings.slice();
    rankings.push(...descendingIds);
    const sortedRankings = Object.values(playerScores).sort((a, b) => b.score - a.score || a.id - b.id).map(({ id }) => id);

    rankingService.playerScores = playerScores;
    rankingService.rankings = rankings;
    rankingService.sortRankings();
    expect(rankingService.rankings).toEqual(sortedRankings);
  });

  it('should set lastUpdate', () => {
    const lastDate = Date.now() - 1;

    rankingService.sortRankings();
    expect(rankingService.lastUpdate).toBeGreaterThan(lastDate);
  });
});

describe('addPlayer', () => {
  const newPlayer = { id: 12335, name: 'Player #12335', score: 11 };

  it('should add target player', () => {
    expect(rankingService.playerScores[newPlayer.id]).toBeFalsy();
    expect(rankingService.rankings.includes(newPlayer.id)).toBeFalsy();

    rankingService.addPlayer(newPlayer);
    expect(rankingService.playerScores[newPlayer.id]).toEqual(newPlayer);
    expect(rankingService.rankings.includes(newPlayer.id)).toBeTruthy();
  });

  it('should sortRankings on update', () => {
    const sortSpy = jest.spyOn(rankingService, 'sortRankings');

    rankingService.addPlayer(newPlayer);
    expect(sortSpy).toHaveBeenCalledTimes(1);
  });
});
