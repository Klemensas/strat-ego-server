import {
  NamePayload,
  BuildPayload,
  RecruitPayload,
  TroopMovementPayload,
  PayloadUnit,
  UpdateSupportPayload,
} from 'strat-ego-common';
import { transaction } from 'objection';

import { knexDb } from '../../sqldb';
import { io, UserSocket, ErrorMessage } from '../../config/socket';
import { worldData } from '../world/worldData';
import { Town } from './town';
import { UnitQueue } from '../unit/unitQueue';
import { Movement } from './movement';
import { townQueue } from '../townQueue';
import * as townQueries from './townQueries';
import { InvolvedTownChanges } from './movementResolver';
import { ProfileService } from '../profile/profileService';
import { BuildingQueue } from '../building/buildingQueue';
import { Report } from '../report/report';

export class TownSocket {
  static async onConnect(socket: UserSocket) {
    socket.on('town:rename', (payload: NamePayload) => this.rename(socket, payload));
    socket.on('town:build', (payload: BuildPayload) => this.build(socket, payload));
    socket.on('town:recruit', (payload: RecruitPayload) => this.recruit(socket, payload));
    socket.on('town:moveTroops', (payload: TroopMovementPayload) => this.moveTroops(socket, payload));
    socket.on('town:recallSupport', (payload: UpdateSupportPayload) => this.cancelSupport(socket, payload, 'origin'));
    socket.on('town:sendBackSupport', (payload: UpdateSupportPayload) => this.cancelSupport(socket, payload, 'target'));

    const towns = await this.getPlayerTowns(socket.userData.playerId);
    socket.userData.townIds = towns.map(({ id }) => id);
    this.joinTownRoom(socket);

    return towns;
  }

  static joinTownRoom(socket: UserSocket) {
    socket.userData.townIds.forEach((id) => socket.join(`town.${id}`));
  }

  static emitToTownRoom(townId: number, payload: any, topic: string = 'town') {
    io.sockets.in(`town.${townId}`).emit(topic, payload);
  }

  static clearTownRoom(room: string, clientAction?: (client) => void) {
    const socketRoom = io.sockets.adapter.rooms[room];
    if (!socketRoom) { return; }

    Object.keys(socketRoom.sockets).forEach((socketId) => {
      const client = io.sockets.connected[socketId] as UserSocket;
      client.leave(room);
      if (clientAction) { clientAction(client); }
    });
  }

  static playersToTownRoom(playerId: number, townRoom: string, clientAction?: (client) => void) {
    const room = `player.${playerId}`;
    const socketRoom = io.sockets.adapter.rooms[room];
    if (!socketRoom) { return; }

    Object.keys(socketRoom.sockets).forEach((socketId) => {
      const client = io.sockets.connected[socketId] as UserSocket;
      client.join(townRoom);
      if (clientAction) { clientAction(client); }
    });
  }

  static getPlayerTowns(playerId: number): Promise<Town[]> {
    return townQueries.getTownsWithItems({ playerId });
  }

  // TODO: look through
  static townConquered(town: Town, report: Report) {
    const room = `town.${town.id}`;
    this.emitToTownRoom(town.id, { townId: town.id, report }, 'town:lost');
    this.clearTownRoom(room, (client: UserSocket) => {
      client.userData = {
        ...client.userData,
        townIds: client.userData.townIds.filter((id) => id !== town.id),
      };
    });

    this.playersToTownRoom(town.playerId, room, (client: UserSocket) => {
      client.userData.townIds.push(town.id);
    });
    this.emitToTownRoom(town.id, { town, report }, 'town:conquered');
  }

  static notifyInvolvedCombatChanges(notifications: InvolvedTownChanges) {
    if (notifications.removed) {
      const { originMovements, targetSupport, originSupport } = notifications.removed;
      if (originMovements && originMovements.ids.length) {
        originMovements.ids.forEach((id, i) =>
          this.emitToTownRoom(originMovements.townIds[i], { id, townId: originMovements.townIds[i] }, 'town:movementDisbanded'));
      }
      if (targetSupport && targetSupport.ids.length) {
        targetSupport.ids.forEach((id, i) =>
          this.emitToTownRoom(targetSupport.townIds[i], { id, townId: targetSupport.townIds[i] }, 'town:sentSupportDestroyed'));
      }
      if (originSupport && originSupport.ids.length) {
        originSupport.ids.forEach((id, i) =>
          this.emitToTownRoom(originSupport.townIds[i], { id, townId: originSupport.townIds[i] }, 'town:supportDisbanded'));
      }
    }

    if (notifications.updated) {
      const { targetSupport } = notifications.updated;
      if (targetSupport && targetSupport.ids.length) {
        targetSupport.ids.forEach((id, i) =>
          this.emitToTownRoom(targetSupport.townIds[i], {
            id,
            changes: targetSupport.changes[i],
            townId: targetSupport.townIds[i],
          }, 'town:sentSupportUpdated'));
      }
    }
  }

  static async rename(socket: UserSocket, payload: NamePayload) {
    try {
      if (!payload.name || !payload.town) { throw new ErrorMessage('Missing required data'); }
      if (!socket.userData.townIds.includes(payload.town)) { throw new ErrorMessage('No town found'); }

      const renamedRows = await townQueries.renameTown(payload.name, payload.town);
      if (!renamedRows) { throw new Error('Couldn\'t find specified player town'); }

      await ProfileService.updateTownProfile(payload.town, { name: payload.name });
      this.emitToTownRoom(payload.town, { name: payload.name, town: payload.town }, 'town:renameSuccess');
    } catch (err) {
      socket.handleError(err, 'name', 'town:renameFail', payload);
    }
  }

  static async build(socket: UserSocket, payload: BuildPayload) {
    try {
      if (!payload.building || !payload.town) { throw new ErrorMessage('Missing required data'); }
      if (!socket.userData.townIds.includes(payload.town)) { throw new ErrorMessage('No town found'); }

      const time = Date.now();
      const buildData = await this.tryBuilding(payload.town, time, payload.building);
      this.emitToTownRoom(payload.town, buildData, 'town:buildSuccess');
    } catch (err) {
      socket.handleError(err, 'build', 'town:buildFail', payload);
    }
  }

  static async recruit(socket: UserSocket, payload: RecruitPayload) {
    if (!payload.units || !payload.town) { throw new ErrorMessage('Missing required data'); }
    if (!socket.userData.townIds.includes(payload.town)) { throw new ErrorMessage('No town found'); }

    try {
      const time = Date.now();
      const recruitData = await this.tryRecruiting(payload.town, time, payload.units);
      this.emitToTownRoom(payload.town, recruitData, 'town:recruitSuccess');
    } catch (err) {
      socket.handleError(err, 'recruit', 'town:recruitFail', payload);
    }
  }

  static async moveTroops(socket: UserSocket, payload: TroopMovementPayload) {
    try {
      if (!payload.town || !payload.target || isNaN(payload.type)) { throw new ErrorMessage('Missing required data'); }
      if (!socket.userData.townIds.includes(payload.town)) { throw new ErrorMessage('No town found'); }

      const time = Date.now();
      const movementData = await this.tryMoving(payload.town, time, payload);
      // TOOD: add movement for target, duhhh
      this.emitToTownRoom(payload.town, movementData, 'town:moveTroopsSuccess');
      delete movementData.item.units;
      this.emitToTownRoom(movementData.item.targetTownId, movementData.item, 'town:incomingMovement');
    } catch (err) {
      socket.handleError(err, 'movement', 'town:moveTroopsFail', payload);
    }
  }

  static async cancelSupport(socket: UserSocket, payload: UpdateSupportPayload, caller: string) {
    const trx = await transaction.start(knexDb.world);
    const action = caller === 'origin' ? 'recallSupport' : 'sendBackSupport';
    try {
      const time = Date.now();
      const target = `${caller}TownId`;
      const support = await townQueries.getTownSupport(payload.support, trx);
      if (!support || !socket.userData.townIds.includes(support[target])) { throw new ErrorMessage('Invalid support item'); }

      const distance = Town.calculateDistance(support.originTown.location, support.targetTown.location);
      const slowest = Object.entries(support.units).reduce((result, [key, value]) => Math.max(result, worldData.unitMap[key].speed), 0);
      const movementTime = time + slowest * distance;

      const movement = await townQueries.cancelSupport(support, movementTime, trx);

      await trx.commit();
      townQueue.addToQueue(movement);
      if (caller === 'origin') {
        this.emitToTownRoom(support.originTownId, { town: payload.town, support: payload.support, movement }, `town:recallSupportSuccess`);
        this.emitToTownRoom(support.targetTownId, { town: payload.town, support: payload.support }, `town:supportRecalled`);
      } else {
        this.emitToTownRoom(support.targetTownId, { town: payload.town, support: payload.support }, `town:sendBackSupportSuccess`);
        this.emitToTownRoom(support.originTownId, { support: payload.support, movement }, `town:supportSentBack`);
      }
    } catch (err) {
      await trx.rollback();
      socket.handleError(err, 'support', `town:${action}Fail`, payload);
    }
  }

  static async tryBuilding(id: number, time: number, building: string): Promise<{ town: Partial<Town>, item: BuildingQueue }> {
    const trx = await transaction.start(knexDb.world);
    try {
      const targetBuilding = worldData.buildingMap[building];
      if (!targetBuilding) { throw new ErrorMessage('Invalid target building'); }

      const town = await townQueries.getTown({ id }, trx);
      const target = town.buildings[building];

      const level = target.queued || target.level;
      if (level === targetBuilding.levels.max) { throw new ErrorMessage('Building already at max level'); }
      const buildingData = targetBuilding.data[level];
      town.resources = town.getResources(time);

      if (!town.doesMeetRequirements(targetBuilding.requirements, 'buildings')) { throw new ErrorMessage('Building requirements not met'); }
      if (!town.hasEnoughResources(buildingData.costs)) { throw new ErrorMessage('Not enough resources to build'); }

      town.resources.clay -= buildingData.costs.clay;
      town.resources.wood -= buildingData.costs.wood;
      town.resources.iron -= buildingData.costs.iron;
      target.queued = level + 1;
      const lastQueue = await townQueries.getLastTownBuildingQueue(id);
      const startTime = lastQueue ? +lastQueue.endsAt : time;
      const endsAt = startTime + buildingData.buildTime;

      const query = await townQueries.createBuildingQueue(
        town,
        {
          level,
          endsAt,
          name: building,
          buildTime: buildingData.buildTime,
          townId: town.id,
        },
        trx,
      );
      const updatedTown = query.town;
      const buildingQueue = query.buildingQueue;
      await trx.commit();

      townQueue.addToQueue(buildingQueue);
      return { town: updatedTown, item: buildingQueue };
    } catch (err) {
      await trx.rollback();
      throw err;
    }
  }

  static async tryRecruiting(id: number, time: number, units: PayloadUnit[]): Promise<{ town: Partial<Town>, item: UnitQueue[] }> {
    const trx = await transaction.start(knexDb.world);
    try {
      const town = await townQueries.getTownWithItems({ id }, trx);
      town.resources = town.getResources(time);
      const unitData = worldData.unitMap;
      const unitsToQueue: Array<Partial<UnitQueue>> = [];
      const availablePopulation = town.getAvailablePopulation();
      const recruitmentModifier = town.getRecruitmentModifier();
      let usedPop = 0;

      for (const unit of units) {
        const targetUnit = unitData[unit.type];
        if (!town.units.hasOwnProperty(unit.type) || +unit.amount <= 0) { throw new ErrorMessage('Wrong unit'); }
        if (!town.doesMeetRequirements(targetUnit.requirements, 'buildings')) { throw new ErrorMessage('Requirements not met'); }
        usedPop += targetUnit.farmSpace * unit.amount;

        town.resources.wood -= targetUnit.costs.wood * unit.amount;
        town.resources.clay -= targetUnit.costs.clay * unit.amount;
        town.resources.iron -= targetUnit.costs.iron * unit.amount;
        town.units[unit.type].queued += unit.amount;

        const lastQueue = await townQueries.getLastTownUnitQueue(town.id);
        const startTime = lastQueue ? +lastQueue.endsAt : time;
        const recruitTime = unit.amount * targetUnit.recruitTime * recruitmentModifier;
        const endsAt = startTime + recruitTime;
        unitsToQueue.push({
          name: unit.type,
          amount: unit.amount,
          townId: id,
          recruitTime,
          endsAt,
        });
      }

      if (usedPop > availablePopulation) { throw new ErrorMessage('Population limit exceeded'); }

      const query = await townQueries.createUnitQueue(
        town,
        unitsToQueue,
        time,
        trx,
      );
      const unitQueue = query.unitQueue;
      const updatedTown = query.town;

      await trx.commit();

      townQueue.addToQueue(unitQueue);
      return {
        town: {
          id: updatedTown.id,
          resources: updatedTown.resources,
          loyalty: updatedTown.loyalty,
          units: updatedTown.units,
          updatedAt: updatedTown.updatedAt,
        },
        item: unitQueue,
      };
      } catch (error) {
        await trx.rollback();
        throw error;
      }
  }

  static async tryMoving(id: number, time: number, payload: TroopMovementPayload): Promise<{ town: Partial<Town>, item: Movement }> {
    const trx = await transaction.start(knexDb.world);
    try {
      const town = await townQueries.getTown({ id }, trx);
      if (String(payload.target) === String(town.location)) { throw new ErrorMessage('A town can\'t attack itself'); }

      const targetTown = await townQueries.getTown({ location: payload.target }, trx);
      if (!targetTown) { throw new ErrorMessage('Invalid target'); }

      let slowest = 0;
      const distance = Town.calculateDistance(town.location, targetTown.location);
      Object.entries(payload.units).forEach(([key, value]) => {
        if (!town.units[key] || town.units[key].inside < value) { throw new ErrorMessage('Invalid unit'); }

        town.units[key].inside -= value;
        slowest = Math.max(slowest, worldData.unitMap[key].speed);
      });
      const movementTime = time + slowest * distance;
      const query = await townQueries.createMovement(
        town,
        targetTown,
        {
          endsAt: movementTime,
          units: payload.units,
          type: payload.type,
        },
        trx,
        true,
      );

      const movement = query.movement;
      const updatedTown = query.town;

      await trx.commit();
      townQueue.addToQueue(movement);
      return {
        town: {
          id: updatedTown.id,
          units: updatedTown.units,
          resources: updatedTown.resources,
          loyalty: updatedTown.loyalty,
          updatedAt: updatedTown.updatedAt,
        },
        item: movement,
      };
    } catch (err) {
      await trx.rollback();
      throw err;
    }
  }
}
