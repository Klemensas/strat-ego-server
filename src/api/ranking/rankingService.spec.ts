import * as lolex from 'lolex';

import { RankingService } from './rankingService';
import { logger } from '../../logger';
import { Player } from '../player/player';
import { worldData } from '../world/worldData';
import { World } from '../world/world';
import * as playerQueries from '../player/playerQueries';
import { ProfileService } from '../profile/profileService';

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
const exampleScores = Object.entries(examplePlayers).reduce((result, [key, { score }]) => ({
  ...result,
  [+key]: score,
}), {});
beforeAll(() => {
  worldData.world = {
    baseProduction: 0,
  } as World;
});

let rankingService: RankingService;
beforeEach(() => {
  rankingService = new RankingService();
  rankingService.playerScores = { ...exampleScores };
  rankingService.playerRankings = [...exampleRankings];
});

describe('initialize', () => {
  const unsortedPlayerProfiles = {
    3: { score: 30 },
    1: { score: 10 },
    2: { score: 20 },
  };
  let localRankings: RankingService;

  beforeEach(() => {
    jest.spyOn(ProfileService, 'getPlayerProfile').mockImplementationOnce(() => unsortedPlayerProfiles);
    localRankings = new RankingService();
  });

  it('should read profiles and set sorted ranking values', async () => {
    expect(localRankings.playerScores).toEqual({});
    expect(localRankings.playerRankings).toEqual([]);

    await localRankings.initialize();
    const idScoreDict = Object.entries(unsortedPlayerProfiles).reduce((result, [key, { score }]) => ({ ...result, [key]: score }), {});
    const sortedIds = Object.keys(unsortedPlayerProfiles).map((id) => +id);
    localRankings.sortRankings(sortedIds, idScoreDict);

    expect(localRankings.playerScores).toEqual(idScoreDict);
    expect(localRankings.playerRankings).toEqual(sortedIds);
  });

  describe('events', () => {
    const payload = { current: { id: 1, playerId: 12, score: 5 }, prev: { score: 1 }, changes: {} };
    beforeEach(async () => {
      await localRankings.initialize();
    });

    it('should call addPlayer on profile add', () => {
      jest.spyOn(localRankings, 'addPlayer');
      ProfileService.playerChanges.emit('add', payload);
      expect(localRankings.addPlayer).toHaveBeenCalledWith(payload);
    });

    it('should call updateTown on town update', () => {
      jest.spyOn(localRankings, 'updateTown');
      ProfileService.townChanges.emit('update', payload);
      expect(localRankings.updateTown).toHaveBeenCalledWith(payload);
    });
  });
});

it('should initially have empty values', () => {
  const freshService = new RankingService();
  expect(freshService.playerScores).toEqual({});
  expect(freshService.playerRankings).toEqual([]);
  expect(freshService.lastUpdate).toEqual(null);
});

it('scores should return ranking value populated with playerScores in order', () => {
  expect(rankingService.scores).toEqual(Object.values(examplePlayers).map(({ score }) => score));

  rankingService.playerRankings.sort((a, b) => rankingService.playerScores[b] - rankingService.playerScores[a]);
  expect(rankingService.scores).not.toEqual(Object.values(examplePlayers));

  rankingService.playerRankings = [];
  expect(rankingService.scores).toEqual([]);
});

describe('updateTown', () => {
  let scoreUpdateSpy: jest.SpyInstance;
  let payload: any;
  beforeEach(() => {
    scoreUpdateSpy = jest.spyOn<any, any>(rankingService, 'updatePlayerScore');
  });

  it('should update time stamp', () => {
    const clock = lolex.install();
    const currentTime = Date.now();
    const tick = 1;

    rankingService.lastUpdate = currentTime;
    clock.tick(tick);
    rankingService.updateTown({ changes: {}, prev: {}, current: {} } as any);
    expect(rankingService.lastUpdate).toEqual(currentTime);
    expect(scoreUpdateSpy).not.toHaveBeenCalled();

    rankingService.updateTown({ changes: { score: 12 }, prev: { score: 1 }, current: { score: 12, playerId: 1 } } as any);
    expect(rankingService.lastUpdate).toEqual(currentTime + tick);
    expect(scoreUpdateSpy).toHaveBeenCalled();
    clock.uninstall();
  });

  describe('player change', () => {
    beforeEach(() => {
      scoreUpdateSpy.mockClear();
    });

    it('should not update score if neither prev or current town has a player', () => {
      payload = {
        current: {},
        prev: {},
        changes: { playerId: null },
      };
      rankingService.updateTown(payload);

      expect(scoreUpdateSpy).not.toHaveBeenCalled();
    });

    it('should only update previous player if current town has no player', () => {
      payload = {
        current: { playerId: null },
        prev: { playerId: 1, score: 11 },
        changes: { playerId: null },
      };
      rankingService.updateTown(payload);
      expect(scoreUpdateSpy).toHaveBeenCalledTimes(1);
      expect(scoreUpdateSpy).toHaveBeenCalledWith(payload.prev.playerId, -payload.prev.score);
    });

    it('should only update current player if prev town has no player', () => {
      payload = {
        current: { playerId: 1, score: 11 },
        prev: { playerId: null },
        changes: { playerId: 1 },
      };
      rankingService.updateTown(payload);
      expect(scoreUpdateSpy).toHaveBeenCalledTimes(1);
      expect(scoreUpdateSpy).toHaveBeenCalledWith(payload.current.playerId, payload.current.score);
    });

    it('should update current and prev player', () => {
      payload = {
        current: { playerId: 1, score: 101 },
        prev: { playerId: 44, score: 11 },
        changes: { playerId: null },
      };
      rankingService.updateTown(payload);
      expect(scoreUpdateSpy).toHaveBeenCalledTimes(2);
      expect(scoreUpdateSpy).toHaveBeenCalledWith(payload.prev.playerId, -payload.prev.score);
      expect(scoreUpdateSpy).toHaveBeenCalledWith(payload.current.playerId, payload.current.score);
    });
  });

  it('should add the score difference to current player', () => {
    payload = {
      current: { playerId: 1, score: 101 },
      prev: { playerId: 44, score: 11 },
      changes: { score: null },
    };
    rankingService.updateTown(payload);
    expect(scoreUpdateSpy).toHaveBeenCalledTimes(1);
    expect(scoreUpdateSpy).toHaveBeenCalledWith(payload.current.playerId, payload.current.score - payload.prev.score);
  });
});

describe('sortRankings', () => {
  it('should sort by score and id', () => {
    expect(rankingService.playerRankings).toEqual(exampleRankings);

    const descendingIds = [44, 4];
    const playerScores = { ...exampleScores };
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

    const rankings = [...exampleRankings];
    rankings.push(...descendingIds);
    const sortedRankings = [...rankings].sort((a, b) => playerScores[b] - playerScores[a] || a - b);

    rankingService.playerScores = playerScores;
    rankingService.playerRankings = rankings;
    rankingService.sortRankings(rankings, playerScores);
    expect(rankings).toEqual(sortedRankings);
  });
});

describe('addPlayer', () => {
  const newPlayer = { id: 12335, name: 'Player #12335', score: 11 } as any;

  it('should add target player', () => {
    expect(rankingService.playerScores[newPlayer.id]).toBeFalsy();
    expect(rankingService.playerRankings.includes(newPlayer.id)).toBeFalsy();

    rankingService.addPlayer({ current: newPlayer, prev: { id: null }, changes: {} });
    expect(rankingService.playerScores[newPlayer.id]).toEqual(newPlayer.score);
    expect(rankingService.playerRankings.includes(newPlayer.id)).toBeTruthy();
  });

  it('should sortRankings on update', () => {
    const sortSpy = jest.spyOn(rankingService, 'sortRankings');

    rankingService.addPlayer({ current: newPlayer, prev: { id: null }, changes: {} });
    expect(sortSpy).toHaveBeenCalledTimes(1);
  });

  it('should set lastUpdate', () => {
    const lastDate = Date.now() - 1;

    rankingService.addPlayer({ current: { id: 11, score: 111 }, prev: { id: null }, changes: {} });
    expect(rankingService.lastUpdate).toBeGreaterThan(lastDate);
  });
});
