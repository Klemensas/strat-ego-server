import { ScoreTracker } from './playerScore';
import { logger } from '../../logger';
import { Player } from './player';
import { knexDb } from '../../sqldb';
import { worldData, WorldData } from '../world/worldData';
import { World } from '../world/world';

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

let scoreTracker: ScoreTracker;
beforeEach(() => {
  scoreTracker = new ScoreTracker();
  scoreTracker.playerScores = { ...examplePlayers };
  scoreTracker.rankings = exampleRankings.slice();
});

test('should initially have empty values', () => {
  const freshTracker = new ScoreTracker();
  expect(freshTracker.playerScores).toEqual({});
  expect(freshTracker.rankings).toEqual([]);
  expect(freshTracker.lastUpdate).toEqual(null);
});

test('scores should return ranking value populated with playerScores in order', () => {
  expect(scoreTracker.scores).toEqual(Object.values(examplePlayers));

  scoreTracker.rankings.sort((a, b) => scoreTracker.playerScores[b].score - scoreTracker.playerScores[a].score);
  expect(scoreTracker.scores).not.toEqual(Object.values(examplePlayers));

  scoreTracker.rankings = [];
  expect(scoreTracker.scores).toEqual([]);
});

describe('readScores', () => {
  let storedPlayers: Player[];
  beforeEach(async () => {
    scoreTracker = new ScoreTracker();
    storedPlayers = await Player.query(knexDb.world).insertGraph(players);
  });
  afterEach(async () => {
    return await Player.query(knexDb.world).del();
  });
  test('should set all player scores', async () => {
    const sortSpy = jest.spyOn(scoreTracker, 'sortRankings');
    await scoreTracker.readScores();
    const expectedPlayers = storedPlayers.reduce((result, item) => ({
      ...result,
      [item.id]: {
        id: item.id,
        name: item.name,
        score: item.towns && item.towns.length ? item.towns.reduce((s, t) => s + t.score, 0) : 0,
      },
    }), {});
    expect(scoreTracker.sortRankings).toHaveBeenCalledTimes(1);
    expect(scoreTracker.rankings).toHaveLength(players.length);
    expect(scoreTracker.playerScores).toEqual(expectedPlayers);
  });
});

test('readScores on error should log and rethrow', async () => {
  const knexSpy = jest.spyOn(knexDb, 'world');
  knexSpy.mockImplementation(() => null);
  const loggerSpy = jest.spyOn(logger, 'error');
  loggerSpy.mockImplementation(() => null);

  let error;
  try {
    await scoreTracker.readScores();
  } catch (err) {
    error = err;
  }
  expect(error).toBeTruthy();
  expect(loggerSpy).toHaveBeenCalled();
  knexSpy.mockRestore();
});

describe('setScore', () => {
  test('should set target player score', () => {
    let targetPlayer = examplePlayers[exampleRankings[0]];
    let expectedScore = 555;

    scoreTracker.setScore(expectedScore, targetPlayer.id);
    expect(scoreTracker.playerScores[targetPlayer.id].score).toEqual(expectedScore);

    targetPlayer = examplePlayers[exampleRankings[1]];
    expectedScore = 1;

    scoreTracker.setScore(expectedScore, targetPlayer.id);
    expect(scoreTracker.playerScores[targetPlayer.id].score).toEqual(expectedScore);
  });

  test('should sortRankings on set', () => {
    const sortSpy = jest.spyOn(scoreTracker, 'sortRankings');

    scoreTracker.setScore(1, scoreTracker.rankings[0]);
    expect(sortSpy).toHaveBeenCalledTimes(1);
  });
});

describe('updateScore', () => {
  test('should update target player score', () => {
    let scoreChange = 10;
    let targetPlayer = examplePlayers[exampleRankings[0]];
    let expectedScore = targetPlayer.score + scoreChange;

    scoreTracker.updateScore(scoreChange, targetPlayer.id);
    expect(scoreTracker.playerScores[targetPlayer.id].score).toEqual(expectedScore);

    scoreChange = -10;
    targetPlayer = examplePlayers[exampleRankings[1]];
    expectedScore = targetPlayer.score + scoreChange;

    scoreTracker.updateScore(scoreChange, targetPlayer.id);
    expect(scoreTracker.playerScores[targetPlayer.id].score).toEqual(expectedScore);
  });

  test('should sortRankings on update', () => {
    const sortSpy = jest.spyOn(scoreTracker, 'sortRankings');

    scoreTracker.updateScore(1, scoreTracker.rankings[0]);
    expect(sortSpy).toHaveBeenCalledTimes(1);
  });
});

describe('sortRankings', () => {
  test('should sort by score and id', () => {
    expect(scoreTracker.rankings).toEqual(exampleRankings);

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

    scoreTracker.playerScores = playerScores;
    scoreTracker.rankings = rankings;
    scoreTracker.sortRankings();
    expect(scoreTracker.rankings).toEqual(sortedRankings);
  });

  test('should set lastUpdate', () => {
    const lastDate = Date.now() - 1;

    scoreTracker.sortRankings();
    expect(scoreTracker.lastUpdate).toBeGreaterThan(lastDate);
  });
});

describe('addPlayer', () => {
  const newPlayer = { id: 12335, name: 'Player #12335', score: 11 };

  test('should add target player', () => {
    expect(scoreTracker.playerScores[newPlayer.id]).toBeFalsy();
    expect(scoreTracker.rankings.includes(newPlayer.id)).toBeFalsy();

    scoreTracker.addPlayer(newPlayer);
    expect(scoreTracker.playerScores[newPlayer.id]).toEqual(newPlayer);
    expect(scoreTracker.rankings.includes(newPlayer.id)).toBeTruthy();
  });

  test('should sortRankings on update', () => {
    const sortSpy = jest.spyOn(scoreTracker, 'sortRankings');

    scoreTracker.addPlayer(newPlayer);
    expect(sortSpy).toHaveBeenCalledTimes(1);
  });
});
