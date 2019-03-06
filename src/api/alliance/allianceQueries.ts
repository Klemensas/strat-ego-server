import { Transaction } from 'objection';
import * as Knex from 'knex';

import { Alliance } from './alliance';
import { Player } from '../player/player';
import { knexDb } from '../../sqldb';
import { setAlliancePermissions, AllianceRole } from './allianceRole';
import { EventType, EventStatus, DiplomacyStatus, DiplomacyType } from 'strat-ego-common';
import { AllianceEvent } from './allianceEvent';
import { AllianceDiplomacy } from './allianceDiplomacy';
import { AllianceMessage } from './allianceMessage';

// TODO: separate event creation from other queries

export function getAlliance(where: Partial<Alliance>, connection: Transaction | Knex = knexDb.world) {
  return Alliance
    .query(connection)
    .findOne(where);
}

export async function getPlayerAlliance(allianceId: number, connection: Transaction | Knex = knexDb.world) {
  const [alliance, events, messages, [diplomacyOrigin, diplomacyTarget]] = await Promise.all([
    getAlliance({ id: allianceId }, connection).modify('selectBase'),
    getAllianceEvents(allianceId, connection),
    getAllianceMessages(allianceId, connection),
    getAllianceDiplomacy(allianceId, connection),
  ]);
  alliance.events = events;
  alliance.messages = messages;
  alliance.diplomacyOrigin = diplomacyOrigin;
  alliance.diplomacyTarget = diplomacyTarget;
  return alliance;
}

export function getAllianceEvents(allianceId: number, connection: Transaction | Knex = knexDb.world) {
  return AllianceEvent
    .query(connection)
    .where('originAllianceId', allianceId)
    .unionAll(function() {
      this
        .from('AllianceEvent')
        .where('targetAllianceId', allianceId);
    })
    .orderBy('createdAt', 'DESC')
    .limit(20);
}

export function getAllianceMessages(allianceId: number, connection: Transaction | Knex = knexDb.world) {
  return AllianceMessage
    .query(connection)
    .where({ allianceId })
    .orderBy('createdAt', 'DESC')
    .limit(20);
}

export function getAllianceRoles(allianceId: number, connection: Transaction | Knex = knexDb.world) {
  return AllianceRole
    .query(connection)
    .where({ allianceId });
}

export function getAllianceDiplomacy(allianceId: number, connection: Transaction | Knex = knexDb.world) {
  return Promise.all([
    AllianceDiplomacy
      .query(connection)
      .where({ originAllianceId: allianceId }),
    AllianceDiplomacy
      .query(connection)
      .where({ targetAllianceId: allianceId }),
  ]);
}

export function getAllianceWithTarget(where: Partial<Alliance>, target: string, connection: Transaction | Knex = knexDb.world) {
  return Alliance
    .query(connection)
    .where(where)
    .orWhere('name', 'ilike', target)
    .eager('[diplomacyOrigin, diplomacyTarget]');
}

// TODO: this is too complex
export async function getFullAlliance(where: Partial<Alliance>, connection: Transaction | Knex = knexDb.world) {
  if (Object.keys(where).length !== 1 || !where.hasOwnProperty('id')) {
    throw new Error('only works with id');
  }
  const alliance = await getAlliance(where, connection)
    .modify('fullAlliance');
  const events = await getAllianceEvents(where.id, connection);

  alliance.events = events;
  return alliance;
}

export function getPlayerAllianceInvites(player: Player, connection: Transaction | Knex = knexDb.world) {
  return Alliance
    .query(connection)
    .joinRelation('invitations')
    .where('invitations.id', player.id)
    .select('Alliance.id', 'Alliance.name');
}

export function getAllianceWithMembersInvites(where: Partial<Alliance>, connection: Transaction | Knex = knexDb.world) {
  return getAlliance(where, connection)
    .eager('[members(selectProfile), invitations(selectPlayerProfile)]');
}

export function getAllianceWithRoles(where: Partial<Alliance>, connection: Transaction | Knex = knexDb.world) {
  return getAlliance(where, connection)
    .eager('roles');
}

export function getAllianceWithMembers(where: Partial<Alliance>, connection: Transaction | Knex = knexDb.world) {
  return getAlliance(where, connection)
    .eager('[members]');
}

export function getAllianceWithMembersRoles(where: Partial<Alliance>, connection: Transaction | Knex = knexDb.world) {
  return getAlliance(where, connection)
    .eager('[members, roles]');
}

export function getAllianceProfile(where: Partial<Alliance>, connection: Transaction | Knex = knexDb.world) {
  return getAllianceWithMembers(where, connection)
    .modifyEager('members', (builder) => builder.select('id'))
    .select(['id', 'name', 'description', 'avatarUrl', 'createdAt']);
}

export function getAllianceProfiles(ids: number[] = [], connection: Transaction | Knex = knexDb.world) {
  const query = Alliance
    .query(connection)
    .eager('members(selectIdAndScore)')
    .select(
      'id',
      'name',
      'description',
      'avatarUrl',
      'createdAt',
    );

  // Filter by ids if any present
  if (ids.length) {
    query.whereIn('id', ids);
  }
  return query;
}

export async function updateAlliance(alliance: Alliance, payload: Partial<Alliance>, connection: Transaction | Knex = knexDb.world) {
  return alliance
    .$query(connection)
    .patch(payload);
}

export async function createAllianceEvent(payload: Partial<AllianceEvent>, connection: Transaction | Knex = knexDb.world) {
  return AllianceEvent
    .query(connection)
    .insert(payload);
}

export function getDiplomacy(where: Partial<Alliance>, connection: Transaction | Knex = knexDb.world) {
  return AllianceDiplomacy
    .query(connection)
    .findOne(where)
    .eager('[originAlliance, targetAlliance]');
}

export async function createAlliance(creator: number, name: string, connection: Transaction | Knex = knexDb.world) {
  const alliance = await Alliance
    .query(connection)
    .insertGraph({
      '#id': 'ally',
      name,
      roles: [{
        name: 'Member',
        permissions: setAlliancePermissions(),
      }, {
        name: 'Owner',
        permissions: setAlliancePermissions({
          viewInvites: true,
          editInvites: true,
          manageForum: true,
          editProfile: true,
          viewManagement: true,
          manageRoles: true,
          manageAlliance: true,
        }),
      }],
      eventOrigin: [{
        originAllianceId: '#ref{ally.id}' as any,
        type: EventType.management,
        status: EventStatus.create,
        originPlayerId: creator,
      }],
      eventTarget: [],
      diplomacyTarget: [],
      diplomacyOrigin: [],
      invitations: [],
      messages: [],
    });
  await alliance
    .$query(connection)
    .patch({
      defaultRoleId: alliance.roles[0].id,
      defaultRole: alliance.roles[0],
      masterRoleId: alliance.roles[1].id,
      masterRole: alliance.roles[1],
    });
  await Player
    .query(connection)
    .patch({
      allianceId: alliance.id,
      allianceRoleId: alliance.masterRole.id,
    })
    .where({ id: creator });

  // Merge events to match get
  alliance.events = [alliance.eventOrigin[0]];
  delete alliance.eventOrigin;
  delete alliance.eventTarget;

  return alliance;
}

export async function createInvite(player: Player, inviterId: number, allianceId: number, connection: Transaction | Knex = knexDb.world) {
  await player
    .$relatedQuery('invitations', connection)
    .relate(allianceId);
  return AllianceEvent
    .query(connection)
    .insert({
      type: EventType.invitation,
      status: EventStatus.create,
      originAllianceId: allianceId,
      originPlayerId: inviterId,
      targetPlayerId: player.id,
    });
}

export async function unrelateInvite(target: Player | Alliance, column: string, id: number, connection: Transaction | Knex = knexDb.world) {
  return target
    .$relatedQuery('invitations', connection)
    .unrelate()
    .where(column, id);
}

export async function cancelInvite(alliance: Alliance, originPlayerId: number, targetPlayerId: number, connection: Transaction | Knex = knexDb.world) {
  await unrelateInvite(alliance, 'playerId', targetPlayerId, connection);

  return AllianceEvent
    .query(connection)
    .insert({
      type: EventType.invitation,
      status: EventStatus.cancel,
      originAllianceId: alliance.id,
      originPlayerId,
      targetPlayerId,
    });
}

export async function rejectInvite(player: Player, allianceId: number, originPlayerId: number, connection: Transaction | Knex = knexDb.world) {
  await unrelateInvite(player, 'allianceId', allianceId, connection);

  return AllianceEvent
    .query(connection)
    .insert({
      type: EventType.invitation,
      status: EventStatus.reject,
      originAllianceId: allianceId,
      targetPlayerId: player.id,
      originPlayerId,
    });
}

export async function acceptInvite(player: Player, allianceId: number, allianceRoleId, connection: Transaction | Knex = knexDb.world) {
  await unrelateInvite(player, 'allianceId', allianceId, connection);
  await player
    .$query(connection)
    .patch({
      allianceId,
      allianceRoleId,
    });

  return AllianceEvent
    .query(connection)
    .insert({
      type: EventType.membership,
      status: EventStatus.join,
      originAllianceId: allianceId,
      originPlayerId: player.id,
    });
}

export async function updateRoles(
  allianceId: number,
  roles: Array<Partial<AllianceRole>>,
  originPlayerId: number,
  connection: Transaction | Knex = knexDb.world,
) {
  return Alliance
    .query(connection)
    .upsertGraph({
      id: allianceId,
      roles,
      eventOrigin: [{
        type: EventType.roles,
        status: EventStatus.update,
        originPlayerId,
      }],
    }, { noDelete: true });
}

export async function removeRole(roleId: number, alliance: Alliance, originPlayerId: number, connection: Transaction | Knex = knexDb.world) {
  await Player
    .query(connection)
    .patch({ allianceRoleId: alliance.defaultRoleId })
    .where({ allianceId: alliance.id, allianceRoleId: roleId });
  await AllianceRole
    .query(connection)
    .deleteById(roleId);
  return AllianceEvent
    .query(connection)
    .insert({
      type: EventType.roles,
      status: EventStatus.update,
      originAllianceId: alliance.id,
      originPlayerId,
    });
}

export async function removeMember(targetPlayerId: number, originPlayerId: number, originAllianceId, connection: Transaction | Knex = knexDb.world) {
  const player = await Player
    .query(connection)
    .patchAndFetchById(targetPlayerId, {
      allianceRoleId: null,
      allianceId: null,
    });
  const event = await AllianceEvent
    .query(connection)
    .insert({
      type: EventType.membership,
      status: EventStatus.remove,
      targetPlayerId,
      originAllianceId,
      originPlayerId,
    });
  return { player, event };
}

export function destroyAlliance(allianceId, connection: Transaction | Knex = knexDb.world) {
  return Alliance
    .query(connection)
    .delete()
    .where({ id: allianceId });
}

export function startWar(
  originPlayerId: number,
  originAllianceId: number,
  targetAllianceId: number,
  reason: string,
  connection: Transaction | Knex = knexDb.world,
) {
  return createDiplomacy(
    {
      originPlayerId,
      originAllianceId,
      targetAllianceId,
      data: { reason },
      type: DiplomacyType.war,
      status: DiplomacyStatus.ongoing,
    },
    EventStatus.startWar,
    connection,
  );
}

export function proposeDiplomacy(
  originPlayerId: number,
  originAllianceId: number,
  targetAllianceId: number,
  type: DiplomacyType,
  connection: Transaction | Knex = knexDb.world,
) {
  const eventStatus = type === DiplomacyType.alliance ? EventStatus.proposeAlliance : EventStatus.proposeNap;
  return createDiplomacy(
    {
      originPlayerId,
      originAllianceId,
      targetAllianceId,
      type,
      status: DiplomacyStatus.pending,
    },
    eventStatus,
    connection,
  );
}

export async function acceptDiplomacy(
  diplomacy: AllianceDiplomacy,
  originPlayerId: number,
  connection: Transaction | Knex = knexDb.world,
) {
  const eventStatus = diplomacy.type === DiplomacyType.alliance ? EventStatus.startAlliance : EventStatus.startNap;
  await diplomacy
    .$query(connection)
    .patch({
      status: DiplomacyStatus.ongoing,
    });
  const event = await AllianceEvent
    .query(connection)
    .insert({
      type: EventType.diplomacy,
      status: eventStatus,
      originAllianceId: diplomacy.originAllianceId,
      targetAllianceId: diplomacy.targetAllianceId,
      originPlayerId,
    });
  return { diplomacy, event };
}

export async function createDiplomacy(
  payload: Partial<AllianceDiplomacy>,
  eventStatus: EventStatus,
  connection: Transaction | Knex = knexDb.world,
) {
  const diplomacy = await AllianceDiplomacy
    .query(connection)
    .insert(payload);
  const event = await AllianceEvent
    .query(connection)
    .insert({
      type: EventType.diplomacy,
      status: eventStatus,
      originAllianceId: payload.originAllianceId,
      originPlayerId: payload.originPlayerId,
      targetAllianceId: payload.targetAllianceId,
    });
  return { diplomacy, event };
}

export async function cancelDiplomacy(
  diplomacy: AllianceDiplomacy,
  originPlayerId: number,
  originAllianceId: number,
  targetAllianceId: number,
  status: EventStatus,
  connection: Transaction | Knex = knexDb.world,
) {
  await diplomacy
    .$query(connection)
    .delete();
  return AllianceEvent
    .query(connection)
    .insert({
      originPlayerId,
      originAllianceId,
      targetAllianceId,
      status,
      type: EventType.diplomacy,
    });
}

// TODO: consider separating event creation
// for example this query has the potential to not update any player resulting in a bad event
export async function updatePlayerRole(
  roleId: number,
  targetPlayerId: number,
  originPlayerId: number,
  originAllianceId: number,
  connection: Transaction | Knex = knexDb.world,
) {
  await Player
    .query(connection)
    .patch({
      allianceRoleId: roleId,
    })
    .where({
      id: targetPlayerId,
      allianceId: originAllianceId,
    });
  return AllianceEvent
    .query(connection)
    .insert({
      type: EventType.roles,
      status: EventStatus.updateMember,
      originPlayerId,
      originAllianceId,
      targetPlayerId,
    });
}

export async function leaveAlliance(
  originPlayerId: number,
  originAllianceId: number,
  connection: Transaction | Knex = knexDb.world,
) {
  const player = await Player
    .query(connection)
    .patch({
      allianceRoleId: null,
      allianceId: null,
    })
    .where({ id: originPlayerId });
  return AllianceEvent
    .query(connection)
    .insert({
      type: EventType.membership,
      status: EventStatus.leave,
      originAllianceId,
      originPlayerId,
    });
}

export async function addMessage(
  text: string,
  playerId: number,
  allianceId: number,
  connection: Transaction | Knex = knexDb.world,
) {
  return AllianceMessage
    .query(connection)
    .insert({
      text,
      playerId,
      allianceId,
    });
}
