import {
  Coords,
  TownError,
  MovementType,
  Dict,
  TownUnit,
  NamePayload,
  BuildPayload,
  RecruitPayload,
  TroopMovementPayload,
  PayloadUnit,
} from 'strat-ego-common';
import { transaction } from 'objection';

import { knexDb } from '../../sqldb';
import { io, UserSocket, AuthenticatedSocket, ErrorMessage } from '../../config/socket';
import { worldData } from '../world/worldData';
import { Town } from './town';
import { BuildingQueue } from '../building/buildingQueue';
import { UnitQueue } from '../unit/unitQueue';
import { Movement } from './movement';
import { townQueue } from '../townQueue';
import { TownSupport } from './townSupport';
import { createBuildingQueue, deleteSupport, getTownSupport, getFullTown } from './townQueries';
import { createUnitQueue, createMovement, renameTown } from './townQueries';

export class TownSocket {
  static onConnect(socket: UserSocket) {
    this.joinTownRoom(socket);

    socket.on('town:rename', (payload: NamePayload) => this.rename(socket, payload));
    socket.on('town:build', (payload: BuildPayload) => this.build(socket, payload));
    socket.on('town:recruit', (payload: RecruitPayload) => this.recruit(socket, payload));
    socket.on('town:moveTroops', (payload: TroopMovementPayload) => this.moveTroops(socket, payload));
    socket.on('town:recallSupport', (payload: number) => this.cancelSupport(socket, payload, 'origin'));
    socket.on('town:sendBackSupport', (payload: number) => this.cancelSupport(socket, payload, 'target'));
    // socket.on('town:update', (payload: SocketPayload) => this.update(socket, payload));
  }

  static joinTownRoom(socket: UserSocket) {
    socket.userData.townIds.forEach((id) => socket.join(String(id)));
  }

  static emitToTownRoom(room: number, payload: any, topic: string = 'town') {
    const roomName = String(room);
    io.sockets.in(roomName).emit(topic, payload);
  }

  static async rename(socket: UserSocket, payload: NamePayload) {
    try {
      if (!payload.name || !payload.town) { throw new ErrorMessage('Missing required data'); }
      if (!socket.userData.townIds.includes(payload.town)) { throw new ErrorMessage('No town found'); }

      const town = await renameTown(payload.name, payload.town);
      this.emitToTownRoom(payload.town, payload.name, 'town:renameSuccess');
    } catch (err) {
      socket.handleError(err, 'name', 'town:renameFail', payload);
    }
  }

  static async build(socket: UserSocket, payload: BuildPayload) {
    try {
      if (!payload.building || !payload.town) { throw new ErrorMessage('Missing required data'); }
      if (!socket.userData.townIds.includes(payload.town)) { throw new ErrorMessage('No town found'); }

      const time = Date.now();
      const town = await this.tryBuilding(payload.town, time, payload.building);
      this.emitToTownRoom(payload.town, town, 'town:buildSuccess');
    } catch (err) {
      socket.handleError(err, 'build', 'town:buildFail', payload);
    }
  }

  static async recruit(socket: UserSocket, payload: RecruitPayload) {
    if (!payload.units || !payload.town) { throw new ErrorMessage('Missing required data'); }
    if (!socket.userData.townIds.includes(payload.town)) { throw new ErrorMessage('No town found'); }

    try {
      const time = Date.now();
      const town = await this.tryRecruiting(payload.town, time, payload.units);
      this.emitToTownRoom(payload.town, town, 'town:recruitSuccess');
    } catch (err) {
      socket.handleError(err, 'recruit', 'town:recruitFail', payload);
    }
  }

  static async moveTroops(socket: UserSocket, payload: TroopMovementPayload) {
    try {
      if (!payload.town || !payload.target || isNaN(payload.type)) { throw new ErrorMessage('Missing required data'); }
      if (!socket.userData.townIds.includes(payload.town)) { throw new ErrorMessage('No town found'); }

      const time = Date.now();
      const { town, movement } = await this.tryMoving(payload.town, time, payload);
      // TOOD: add movement for target, duhhh
      this.emitToTownRoom(payload.town, town, 'town:moveTroopsSuccess');
      delete movement.units;
      this.emitToTownRoom(movement.targetTownId, movement, 'town:incomingMovement');
    } catch (err) {
      socket.handleError(err, 'movement', 'town:moveTroopsFail', payload);
    }
  }

  static async cancelSupport(socket: UserSocket, payload: number, caller: string) {
    const trx = await transaction.start(knexDb.world);
    const action = caller === 'origin' ? 'recallSupport' : 'sendBackSupport';
    try {
      const time = Date.now();
      const target = `${caller}TownId`;
      const support = await getTownSupport(payload, trx);
      if (!support || !socket.userData.townIds.includes(support[target])) { throw new ErrorMessage('Invalid support item'); }

      const distance = Town.calculateDistance(support.originTown.location, support.targetTown.location);
      const slowest = Object.entries(support.units).reduce((result, [key, value]) => Math.max(result, worldData.unitMap[key].speed), 0);
      const movementTime = time + slowest * distance;

      const movement = await deleteSupport(support, movementTime, trx);

      await trx.commit();
      townQueue.addToQueue(movement);
      if (caller === 'origin') {
        this.emitToTownRoom(support.originTownId, { support: payload, movement }, `town:recallSupportSuccess`);
        this.emitToTownRoom(support.targetTownId, { support: payload, town: support.targetTownId }, `town:supportRecalled`);
      } else {
        this.emitToTownRoom(support.targetTownId, payload, `town:sendBackSupportSuccess`);
        this.emitToTownRoom(support.originTownId, { support: payload, movement }, `town:supportSentBack`);
      }
    } catch (err) {
      await trx.rollback();
      socket.handleError(err, 'support', `town:${action}Fail`, payload);
    }
  }

  static async tryBuilding(id: number, time: number, building: string) {
    const trx = await transaction.start(knexDb.world);
    try {
      const targetBuilding = worldData.buildingMap[building];
      if (!targetBuilding) { throw new ErrorMessage('Invalid target building'); }

      const town = await getFullTown({ id }, trx);
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
      const lastQueue = town.getLastQueue('buildingQueues');
      const endsAt = (lastQueue ? +lastQueue.endsAt : time) + buildingData.buildTime;

      const query = await createBuildingQueue(
        town,
        {
          level,
          endsAt,
          name: building,
          buildTime: buildingData.buildTime,
        },
        trx,
      );
      const updatedTown = query.town;
      const buildingQueue = query.buildingQueue;
      await trx.commit();

      townQueue.addToQueue(buildingQueue);
      return updatedTown;
    } catch (err) {
      await trx.rollback();
      throw err;
    }
  }

  static async tryRecruiting(id: number, time: number, units: PayloadUnit[]) {
    const trx = await transaction.start(knexDb.world);
    try {
      const town = await getFullTown({ id }, trx);
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
        usedPop += unit.amount;

        town.resources.wood -= targetUnit.costs.wood * unit.amount;
        town.resources.clay -= targetUnit.costs.clay * unit.amount;
        town.resources.iron -= targetUnit.costs.iron * unit.amount;
        town.units[unit.type].queued += unit.amount;

        const lastQueue = town.getLastQueue('unitQueues');
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

      const query = await createUnitQueue(
        town,
        unitsToQueue,
        time,
        trx,
      );
      const unitQueue = query.unitQueue;
      const updatedTown = query.town;

      await trx.commit();

      townQueue.addToQueue(unitQueue);
      return updatedTown;
      } catch (error) {
        await trx.rollback();
        throw error;
      }
  }

  static async tryMoving(id: number, time: number, payload: TroopMovementPayload): Promise<{ town: Town, movement: Movement }> {
    const trx = await transaction.start(knexDb.world);
    try {
      const town = await getFullTown({ id }, trx);
      if (payload.target === town.location) { throw new ErrorMessage('A town can\'t attack itself'); }

      const targetTown = await getFullTown({ location: payload.target }, trx);
      if (!targetTown) { throw new ErrorMessage('Invalid target'); }

      let slowest = 0;
      const distance = Town.calculateDistance(town.location, targetTown.location);
      Object.entries(payload.units).forEach(([key, value]) => {
        if (!town.units[key] || town.units[key].inside < value) { throw new ErrorMessage('Invalid unit'); }

        town.units[key].inside -= value;
        slowest = Math.max(slowest, worldData.unitMap[key].speed);
      });
      const movementTime = time + slowest * distance;
      const query = await createMovement(
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
      return { town: updatedTown, movement };
    } catch (err) {
      await trx.rollback();
      throw err;
    }
  }
}
