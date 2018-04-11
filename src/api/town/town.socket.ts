import { Coords, TownError, MovementType, MovementUnit } from 'strat-ego-common';
import { transaction } from 'objection';

import { io } from '../../';
import { knexDb } from '../../sqldb';
import { UserSocket, AuthenticatedSocket, ErrorMessage } from '../../config/socket';
import { worldData } from '../world/worldData';
import { Town } from './town';
import { BuildingQueue } from '../building/buildingQueue';
import { UnitQueue } from '../unit/unitQueue';
import { Movement } from './movement';

export interface SocketPayload { town: number; }
export interface NamePayload extends SocketPayload { name: string; }
export interface BuildPayload extends SocketPayload { building: string; }
export interface PayloadUnit { type: string; amount: number; }
export interface RecruitPayload extends SocketPayload {
  units: PayloadUnit[];
}
export interface TroopMovementPayload extends SocketPayload {
  units: MovementUnit[];
  type: MovementType;
  target: Coords;
}

export class TownSocket {
  static onConnect(socket: UserSocket) {
    this.joinTownRoom(socket);

    socket.on('town:rename', (payload: NamePayload) => this.rename(socket, payload));
    socket.on('town:build', (payload: BuildPayload) => this.build(socket, payload));
    socket.on('town:recruit', (payload: RecruitPayload) => this.recruit(socket, payload));
    socket.on('town:moveTroops', (payload: TroopMovementPayload) => this.moveTroops(socket, payload));
    socket.on('town:update', (payload: SocketPayload) => this.update(socket, payload));
  }

  static joinTownRoom(socket: UserSocket) {
    socket.userData.townIds.forEach((id) => socket.join(String(id)));
  }

  static emitToTownRoom(room: number, payload: any, topic: string = 'town') {
    const roomName = String(room);
    io.sockets.in(roomName).emit(topic, payload);
  }

  private static async rename(socket: UserSocket, payload: NamePayload) {
    try {
      if (!payload.name || !payload.town) { throw new ErrorMessage('Missing required data'); }
      if (!socket.userData.townIds.includes(payload.town)) { throw new ErrorMessage('No town found'); }

      const town = await Town.query(knexDb.world)
        .patch({ name: payload.name })
        .where({
          id: payload.town,
          playerId: socket.userData.playerId,
        })
        .eager(Town.townRelations);
      this.emitToTownRoom(payload.town, payload.name, 'town:renameSuccess');
    } catch (err) {
      socket.handleError(err, 'name', 'town:renameFail', payload);
    }
  }

  private static async build(socket: UserSocket, payload: BuildPayload) {
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

  private static async recruit(socket: UserSocket, payload: RecruitPayload) {
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

  private static async moveTroops(socket: UserSocket, payload: TroopMovementPayload) {
    try {
      if (!payload.town || !payload.target || isNaN(payload.type)) { throw new ErrorMessage('Missing required data'); }
      if (!socket.userData.townIds.includes(payload.town)) { throw new ErrorMessage('No town found'); }

      const time = Date.now();
      const town = await this.tryMoving(payload.town, time, payload);
      this.emitToTownRoom(payload.town, town, 'town:moveTroopsSuccess');
    } catch (err) {
      socket.handleError(err, 'movement', 'town:moveTroopsFail', payload);
    }
  }

  private static async tryBuilding(id: number, time: number, building: string) {
    const trx = await transaction.start(knexDb.world);
    try {
      const targetBuilding = worldData.buildingMap[building];
      if (!targetBuilding) { throw new ErrorMessage('Invalid target building'); }

      const town = await Town.query(trx).findById(id).eager(Town.townRelations);
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

      await town.$relatedQuery<BuildingQueue>('buildingQueues', trx).insert({
        level,
        endsAt,
        name: building,
        buildTime: buildingData.buildTime,
      });
      await town.$query(trx)
        .patch({
          resources: town.resources,
          buildings: town.buildings,
          updatedAt: time,
        })
        .eager(Town.townRelations)
        .context({ resourcesUpdated: true });

      await trx.commit();

      return town;
    } catch (err) {
      await trx.rollback();
      throw err;
    }
  }

  private static async tryRecruiting(id: number, time: number, units: PayloadUnit[]) {
    const trx = await transaction.start(knexDb.world);
    try {
      const town = await Town.query(trx).findById(id).eager(Town.townRelations);
      town.resources = town.getResources(time);
      const unitData = worldData.unitMap;
      const unitsToQueue = [];
      const availablePopulation = town.getAvailablePopulation();
      const recruitmentModifier = town.getRecruitmentModifier();
      let usedPop = 0;

      for (const unit of units) {
        const targetUnit = unitData[unit.type];
        if (!town.units.hasOwnProperty(unit.type) || +unit.amount <= 0) { throw new ErrorMessage('Wrong unit'); }
        if (!town.doesMeetRequirements(targetUnit.requirements, 'units')) { throw new ErrorMessage('Requirements not met'); }
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

      await town.$relatedQuery<UnitQueue>('unitQueues', trx).insert(unitsToQueue);
      await town.$query(trx)
        .patch({
          resources: town.resources,
          units: town.units,
          updatedAt: time,
        })
        .eager(Town.townRelations)
        .context({ resourcesUpdated: true });

      await trx.commit();

      return town;
      } catch (error) {
        await trx.rollback();
        throw error;
      }
  }

  private static async tryMoving(id: number, time: number, payload: TroopMovementPayload) {
    const trx = await transaction.start(knexDb.world);
    try {
      const unitData = worldData.unitMap;
      let slowest = 0;

      const town = await Town.query(trx).findById(id).eager(Town.townRelations);
      if (payload.target === town.location) { throw new ErrorMessage('A town can\'t attack itself'); }

      const targetTown = await Town.query(trx).findOne({ location: payload.target }).eager(Town.townRelations);
      if (!targetTown) { throw new ErrorMessage('Invalid target'); }

      const distance = Town.calculateDistance(town.location, targetTown.location);
      const units = {};
      for (const unit of payload.units) {
        if (!town.units.hasOwnProperty(unit[0])) { throw new ErrorMessage('No such unit'); }

        units[unit[0]] = unit[1];
        town.units[unit[0]].inside -= unit[1];
        town.units[unit[0]].outside += unit[1];
        slowest = Math.max(unitData[unit[0]].speed, slowest);
      }
      const movementTime = slowest * distance;
      await town.$relatedQuery<Movement>('originMovements', trx).insert({
        units,
        type: payload.type,
        targetTownId: targetTown.id,
        endsAt: time + movementTime,
      });
      await town.$query(trx)
        .patch({
          units: town.units,
        })
        .eager(Town.townRelations);
      await trx.commit();

      return town;
    } catch (err) {
      await trx.rollback();
      throw err;
    }
  }

  private static update(socket: UserSocket, payload: SocketPayload) {
    // if (!payload.town) { return Promise.reject('No town specified'); }

    // const time = new Date();
    // return Town.processTownQueues(payload.town, time)
    //   .then(({ town, processed }) => {
    //     const processedAttack = processed.some((queue) =>
    //       queue.constructor.name === 'Movement' && queue.type === 'attack');

    //     // TODO: handle town rooms on lose as well
    //     if (!processedAttack) { return town.notify({ type: 'update' }); }

    //     // Refresh whole player in case of a lost town
    //     return Player.getPlayer({ UserId: socket.userData.userId })
    //       .then((player) => {
    //         socket.userData = {
    //           ...socket.userData,
    //           townIds: player.Towns.map(({ id }) => id),
    //         };
    //         socket.emit('player', player);
    //       });
    //   });
  }
}
