import { ProfileService } from './profileService';
import { getPlayerProfiles } from '../player/playerQueries';
import { getAllianceProfiles } from '../alliance/allianceQueries';
import { getTownProfiles } from '../town/townQueries';

const playerProfiles = { 566: { name: 'playa', towns: [] }, 873: { name: 'gaaawd', towns: [] } };
const townProfiles = { 2: { name: 'town of playa', playerId: 1 }, 3: { name: 'no'} };
const allianceProfiles = { 33: { name: 'alliance', members: [] }, 15: { name: 'ally', members: [] } };
describe('initialize', () => {
  beforeEach(() => {
    ProfileService.playerProfiles = {};
    ProfileService.townProfiles = {};
    ProfileService.allianceProfiles = {};

    jest.spyOn(ProfileService, 'getPlayerProfile').mockImplementationOnce(() => Promise.resolve(playerProfiles));
    jest.spyOn(ProfileService, 'getTownProfile').mockImplementationOnce(() => Promise.resolve(townProfiles));
    jest.spyOn(ProfileService, 'getAllianceProfile').mockImplementationOnce(() => Promise.resolve(allianceProfiles));
  });

  it('should load player, town, alliance profiles', async () => {
    expect(ProfileService.getPlayerProfile).not.toHaveBeenCalled();
    expect(ProfileService.getTownProfile).not.toHaveBeenCalled();
    expect(ProfileService.getAllianceProfile).not.toHaveBeenCalled();

    await ProfileService.initialize();
    expect(ProfileService.getPlayerProfile).toHaveBeenCalled();
    expect(ProfileService.getTownProfile).toHaveBeenCalled();
    expect(ProfileService.getAllianceProfile).toHaveBeenCalled();
  });

  it('should set profiles and return the values', async () => {
    const result = await ProfileService.initialize();
    expect(ProfileService.playerProfiles).toEqual(playerProfiles);
    expect(ProfileService.townProfiles).toEqual(townProfiles);
    expect(ProfileService.allianceProfiles).toEqual(allianceProfiles);
    expect(result).toEqual({
      playerProfiles,
      townProfiles,
      allianceProfiles,
    });
  });
});

describe('profile loading', () => {
  let getProfileSpy: jest.Mock;
  const result = { test: true };
  const ids = [12, 54, 446];

  beforeEach(() => {
    getProfileSpy = jest.spyOn<any, any>(ProfileService, 'getProfiles').mockImplementation(() => Promise.resolve(result));
  });

  it('getPlayerProfile should get player specific profiles', async () => {
    await ProfileService.getPlayerProfile();
    expect(getProfileSpy).toHaveBeenCalledWith(ProfileService.playerProfiles, [], getPlayerProfiles, expect.anything());

    const profiles = await ProfileService.getPlayerProfile(ids);
    expect(getProfileSpy).toHaveBeenCalledWith(ProfileService.playerProfiles, ids, getPlayerProfiles, expect.anything());
    expect(profiles).toEqual(result);
  });

  it('getTownProfile should get town specific profiles', async () => {
    await ProfileService.getTownProfile();
    expect(getProfileSpy).toHaveBeenCalledWith(ProfileService.townProfiles, [], getTownProfiles, expect.anything());

    const profiles = await ProfileService.getTownProfile(ids);
    expect(getProfileSpy).toHaveBeenCalledWith(ProfileService.townProfiles, ids, getTownProfiles, expect.anything());
    expect(profiles).toEqual(result);
  });

  it('getAllianceProfile should get alliance specific profiles', async () => {
    await ProfileService.getAllianceProfile();
    expect(getProfileSpy).toHaveBeenCalledWith(ProfileService.allianceProfiles, [], getAllianceProfiles, expect.anything());

    const profiles = await ProfileService.getAllianceProfile(ids);
    expect(getProfileSpy).toHaveBeenCalledWith(ProfileService.allianceProfiles, ids, getAllianceProfiles, expect.anything());
    expect(profiles).toEqual(result);
  });
});

describe('updatePlayerProfile', () => {
  const profile = { id: 12, name: 'profile', score: 11 };
  beforeEach(() => {
    jest.spyOn(ProfileService, 'updateAllianceProfile');
    ProfileService.allianceProfiles = { ...allianceProfiles } as any;
  });

  it('should emit player changes', () => {
    const playerChanges = jest.fn();

    ProfileService.playerChanges.on('add', playerChanges);
    ProfileService.playerChanges.on('update', playerChanges);
    let newProfile = ProfileService.updatePlayerProfile(profile.id, profile, false);

    expect(playerChanges).toHaveBeenCalledWith({ prev: {}, current: profile, changes: profile });
    expect(newProfile).toEqual(profile);

    const profileChanges = { score: 121, test: 'true' };
    const updatedProfile = { ...profile, ...profileChanges };
    newProfile = ProfileService.updatePlayerProfile(profile.id, profileChanges, false);
    expect(playerChanges).toHaveBeenCalledWith({ prev: profile, current: updatedProfile, changes: profileChanges });
    expect(newProfile).toEqual(updatedProfile);

    expect(ProfileService.updateAllianceProfile).not.toHaveBeenCalled();
  });

  it('should update alliance profile if player left', () => {
    const allianceId = +Object.keys(allianceProfiles)[0];
    const members = [
      { id: 134 },
      { id: profile.id },
      { id: 324 },
      { id: 22 },
    ];
    ProfileService.allianceProfiles[allianceId] = {
      ...ProfileService.allianceProfiles[allianceId],
      members,
    };
    const prevProfile = { ...profile, allianceId };
    ProfileService.playerProfiles = {
      [prevProfile.id]: prevProfile,
    };
    ProfileService.updatePlayerProfile(profile.id, { ...profile, allianceId: null }, true);
    expect(ProfileService.updateAllianceProfile).toHaveBeenCalledTimes(1);
    expect(ProfileService.updateAllianceProfile).toHaveBeenCalledWith(
      allianceId,
      { members: members.filter(({ id }) => id !== profile.id) },
      false,
    );
  });

  it('should update alliance profile if player joined', () => {
    const allianceId = +Object.keys(allianceProfiles)[0];
    const members = [
      { id: 134 },
      { id: 324 },
      { id: 22 },
    ];
    ProfileService.allianceProfiles[allianceId] = {
      ...ProfileService.allianceProfiles[allianceId],
      members,
    };
    const prevProfile = { ...profile, allianceId: null };
    ProfileService.playerProfiles = {
      [prevProfile.id]: prevProfile,
    };
    ProfileService.updatePlayerProfile(profile.id, { ...profile, allianceId }, true);
    expect(ProfileService.updateAllianceProfile).toHaveBeenCalledTimes(1);
    expect(ProfileService.updateAllianceProfile).toHaveBeenCalledWith(
      allianceId,
      { members: members.concat({ id: profile.id }) },
      false,
    );
  });

  it('should update two alliance profiles if player changed alliance', () => {
    const prevAllianceId = +Object.keys(allianceProfiles)[0];
    const currentAllianceId = +Object.keys(allianceProfiles)[1];
    const prevProfile = { ...profile, allianceId: prevAllianceId };
    const prevMembers = [
      { id: 134 },
      { id: profile.id },
      { id: 324 },
      { id: 22 },
    ];
    const currentMembers = [
      { id: 1340 },
      { id: 3240 },
      { id: 220 },
    ];

    ProfileService.allianceProfiles[prevAllianceId] = {
      ...ProfileService.allianceProfiles[prevAllianceId],
      members: prevMembers,
    };
    ProfileService.allianceProfiles[currentAllianceId] = {
      ...ProfileService.allianceProfiles[currentAllianceId],
      members: currentMembers,
    };

    ProfileService.playerProfiles = {
      [prevProfile.id]: prevProfile,
    };

    ProfileService.updatePlayerProfile(profile.id, { ...profile, allianceId: currentAllianceId }, true);
    expect(ProfileService.updateAllianceProfile).toHaveBeenCalledTimes(2);
    expect(ProfileService.updateAllianceProfile).toHaveBeenCalledWith(
      prevAllianceId,
      { members: prevMembers.filter(({ id }) => id !== profile.id) },
      false,
    );
    expect(ProfileService.updateAllianceProfile).toHaveBeenCalledWith(
      currentAllianceId,
      { members: currentMembers.concat({ id: profile.id }) },
      false,
    );
  });
});

describe('updateTownProfile', () => {
  const profile = { id: 12, name: 'profile', score: 11 };
  beforeEach(() => {
    jest.spyOn(ProfileService, 'updatePlayerProfile');
    ProfileService.playerProfiles = { ...playerProfiles } as any;
  });

  it('should emit town changes', () => {
    const townChanges = jest.fn();

    ProfileService.townChanges.on('add', townChanges);
    ProfileService.townChanges.on('update', townChanges);
    let newProfile = ProfileService.updateTownProfile(profile.id, profile, false);

    expect(townChanges).toHaveBeenCalledWith({ prev: {}, current: profile, changes: profile });
    expect(newProfile).toEqual(profile);

    const profileChanges = { score: 121, test: 'true' };
    const updatedProfile = { ...profile, ...profileChanges };
    newProfile = ProfileService.updateTownProfile(profile.id, profileChanges, false);
    expect(townChanges).toHaveBeenCalledWith({ prev: profile, current: updatedProfile, changes: profileChanges });
    expect(newProfile).toEqual(updatedProfile);

    expect(ProfileService.updatePlayerProfile).not.toHaveBeenCalled();
  });

  it('should update player profile if town has no player', () => {
    const playerId = +Object.keys(playerProfiles)[0];
    const towns = [
      { id: 134 },
      { id: profile.id },
      { id: 324 },
      { id: 22 },
    ];
    ProfileService.playerProfiles[playerId] = {
      ...ProfileService.playerProfiles[playerId],
      towns,
    };
    const prevProfile = { ...profile, playerId };
    ProfileService.townProfiles = {
      [prevProfile.id]: prevProfile,
    };
    ProfileService.updateTownProfile(profile.id, { ...profile, playerId: null }, true);
    expect(ProfileService.updatePlayerProfile).toHaveBeenCalledTimes(1);
    expect(ProfileService.updatePlayerProfile).toHaveBeenCalledWith(
      playerId,
      { towns: towns.filter(({ id }) => id !== profile.id) },
      false,
    );
  });

  it('should update player profile if town accuired player', () => {
    const playerId = +Object.keys(playerProfiles)[0];
    const towns = [
      { id: 134 },
      { id: 324 },
      { id: 22 },
    ];
    ProfileService.playerProfiles[playerId] = {
      ...ProfileService.playerProfiles[playerId],
      towns,
    };
    const prevProfile = { ...profile, playerId: null };
    ProfileService.townProfiles = {
      [prevProfile.id]: prevProfile,
    };
    ProfileService.updateTownProfile(profile.id, { ...profile, playerId }, true);
    expect(ProfileService.updatePlayerProfile).toHaveBeenCalledTimes(1);
    expect(ProfileService.updatePlayerProfile).toHaveBeenCalledWith(
      playerId,
      { towns: towns.concat({ id: profile.id }) },
      false,
    );
  });

  it('should update two player profiles if town changed player', () => {
    const prevPlayerId = +Object.keys(playerProfiles)[0];
    const currentPlayerId = +Object.keys(playerProfiles)[1];
    const prevProfile = { ...profile, playerId: prevPlayerId };
    const prevTowns = [
      { id: 134 },
      { id: profile.id },
      { id: 324 },
      { id: 22 },
    ];
    const currentTowns = [
      { id: 1340 },
      { id: 3240 },
      { id: 220 },
    ];

    ProfileService.playerProfiles[prevPlayerId] = {
      ...ProfileService.playerProfiles[prevPlayerId],
      towns: prevTowns,
    };
    ProfileService.playerProfiles[currentPlayerId] = {
      ...ProfileService.playerProfiles[currentPlayerId],
      towns: currentTowns,
    };

    ProfileService.townProfiles = {
      [prevProfile.id]: prevProfile,
    };

    ProfileService.updateTownProfile(profile.id, { ...profile, playerId: currentPlayerId }, true);
    expect(ProfileService.updatePlayerProfile).toHaveBeenCalledTimes(2);
    expect(ProfileService.updatePlayerProfile).toHaveBeenCalledWith(
      prevPlayerId,
      { towns: prevTowns.filter(({ id }) => id !== profile.id) },
      false,
    );
    expect(ProfileService.updatePlayerProfile).toHaveBeenCalledWith(
      currentPlayerId,
      { towns: currentTowns.concat({ id: profile.id }) },
      false,
    );
  });
});

describe('updateAllianceProfile', () => {
  const members = [
    { id: 134 },
    { id: 324 },
    { id: 22 },
  ];
  const profile = { id: 12, name: 'profile', score: 11, members: [...members] };
  beforeEach(() => {
    jest.spyOn(ProfileService, 'updatePlayerProfile');
    ProfileService.playerProfiles = { ...playerProfiles } as any;
  });

  it('should emit alliance changes', () => {
    const allianceChanges = jest.fn();

    ProfileService.allianceChanges.on('add', allianceChanges);
    ProfileService.allianceChanges.on('update', allianceChanges);
    let newProfile = ProfileService.updateAllianceProfile(profile.id, profile, false);

    expect(allianceChanges).toHaveBeenCalledWith({ prev: {}, current: profile, changes: profile });
    expect(newProfile).toEqual(profile);

    const profileChanges = { score: 121, test: 'true' };
    const updatedProfile = { ...profile, ...profileChanges };
    newProfile = ProfileService.updateAllianceProfile(profile.id, profileChanges, false);
    expect(allianceChanges).toHaveBeenCalledWith({ prev: profile, current: updatedProfile, changes: profileChanges });
    expect(newProfile).toEqual(updatedProfile);

    expect(ProfileService.updatePlayerProfile).not.toHaveBeenCalled();
  });

  it('should update removed player profiles', () => {
    const prevProfile = { ...profile };
    ProfileService.allianceProfiles = {
      [prevProfile.id]: prevProfile,
    };
    const removedMembers = members.filter((m, i) => i % 2);
    const newMembers = members.filter((m, i) => !(i % 2));

    ProfileService.updateAllianceProfile(profile.id, { ...profile, members: newMembers }, true);

    expect(ProfileService.updatePlayerProfile).toHaveBeenCalled();
    expect(ProfileService.updatePlayerProfile).toHaveBeenCalledTimes(members.length - newMembers.length);

    removedMembers.forEach((member) => {
      expect(ProfileService.updatePlayerProfile).toHaveBeenCalledWith(
        member.id,
        { allianceId: null },
        false,
      );
    });
  });

  it('should update added player profiles', () => {
    const prevProfile = { ...profile };
    ProfileService.allianceProfiles = {
      [prevProfile.id]: prevProfile,
    };
    const membersToAdd = [{ id: 81287 }, { id: 56578 }, {id: 10000001 }];

    ProfileService.updateAllianceProfile(profile.id, { ...profile, members: [...profile.members, ...membersToAdd] }, true);

    expect(ProfileService.updatePlayerProfile).toHaveBeenCalled();
    expect(ProfileService.updatePlayerProfile).toHaveBeenCalledTimes(membersToAdd.length);

    membersToAdd.forEach((member) => {
      expect(ProfileService.updatePlayerProfile).toHaveBeenCalledWith(
        member.id,
        { allianceId: profile.id },
        false,
      );
    });
  });

  it('should update added and removed player profiles', () => {
    const prevProfile = { ...profile };
    ProfileService.allianceProfiles = {
      [prevProfile.id]: prevProfile,
    };
    const removedMembers = members.filter((m, i) => !(i % 2));
    const membersToAdd = [{ id: 2000000002 }, { id: 2000000009 }, {id: 2000000001 }];
    const newMembers = members.filter((m, i) => i % 2);
    const updatedMembers = [...newMembers, ...membersToAdd];

    ProfileService.updateAllianceProfile(profile.id, { ...profile, members: updatedMembers }, true);

    expect(ProfileService.updatePlayerProfile).toHaveBeenCalled();
    expect(ProfileService.updatePlayerProfile).toHaveBeenCalledTimes(membersToAdd.length + removedMembers.length);

    membersToAdd.forEach((member) => {
      expect(ProfileService.updatePlayerProfile).toHaveBeenCalledWith(
        member.id,
        { allianceId: profile.id },
        false,
      );
    });
    removedMembers.forEach((member) => {
      expect(ProfileService.updatePlayerProfile).toHaveBeenCalledWith(
        member.id,
        { allianceId: null },
        false,
      );
    });
  });
});

describe('deleteAllianceProfile', () => {
  const profiles =  {
    1: { id: 1, name: 'all', members: [] },
    2: { id: 2, name: 'ally', members: [] },
    3: { id: 3, name: 'allciance', members: [] },
  };
  beforeEach(() => {
    ProfileService.allianceProfiles = { ...profiles };
    jest.spyOn(ProfileService, 'updatePlayerProfile').mockImplementation(() => null);
  });

  it('should remove deleted alliance from the list', () => {
    const target = profiles[2].id;
    expect(ProfileService.allianceProfiles).toEqual(profiles);
    ProfileService.deleteAllianceProfile(target);
    const profilesWithoutTarget = Object.values(profiles)
      .filter(({ id }) => id !== target)
      .reduce((result, value) => ({ ...result, [value.id]: { ...value }}), {});

    expect(ProfileService.allianceProfiles).toEqual(profilesWithoutTarget);
  });

  it('should emit alliance change event', () => {
    const target = profiles[3].id;

    const allianceChange = jest.fn();
    ProfileService.allianceChanges.on('remove', allianceChange);
    ProfileService.deleteAllianceProfile(target);
    expect(allianceChange).toHaveBeenCalledWith({ id: target });
  });
});

describe('addPlayerProfile', () => {
  it('should update player and town profiles', () => {
    jest.spyOn(ProfileService, 'updatePlayerProfile');
    jest.spyOn(ProfileService, 'updateTownProfile');

    const playerProfile = { id: 1, name: 'playa' };
    const townProfile = { id: 2, name: 'townz' };

    ProfileService.addPlayerProfile(playerProfile, townProfile);
    expect(ProfileService.updatePlayerProfile).toHaveBeenCalledWith(playerProfile.id, playerProfile, false);
    expect(ProfileService.updateTownProfile).toHaveBeenCalledWith(townProfile.id, townProfile, false);
  });
});

describe('addNpcTowns', () => {
  const npcTowns = [
    { id: 1, name: 'wat-1', location: [101, 101], score: 11, createdAt: Date.now() },
    { id: 2, name: 'wat-2', location: [202, 202], score: 22, createdAt: Date.now() },
    { id: 3, name: 'wat-3', location: [303, 303], score: 33, createdAt: Date.now() },
  ] as any;
  const profiles = npcTowns.reduce((result, town) => ({ ...result, [town.id]: {
    id: town.id,
    name: town.name,
    location: town.location,
    score: town.score,
    playerId: null,
    createdAt: town.createdAt,
  }}), {});

  it('should add new town profiles', () => {
    ProfileService.townProfiles = {};
    ProfileService.addNpcTowns(npcTowns);
    expect(ProfileService.townProfiles).toEqual(profiles);
  });

  it('should keep the existing town profiles', () => {
    ProfileService.townProfiles = { ...profiles };
    ProfileService.addNpcTowns([]);
    expect(ProfileService.townProfiles).toEqual(profiles);
  });
});
