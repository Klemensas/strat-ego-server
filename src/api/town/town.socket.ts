import * as Bluebird from 'bluebird';
import { WorldDataService } from '../../components/world';
import { Town, townIncludes, Coords } from './town.model';
import { Player } from '../world/player.model';
import { UnitQueue } from '../world/unitQueue.model';
import { world } from '../../sqldb';
import { UserSocket, AuthenticatedSocket } from 'config/socket';
import { MovementType } from 'api/town/movement.model';

export interface SocketPayload { town: number; }
export interface NamePayload extends SocketPayload { name: string; }
export interface BuildPayload extends SocketPayload { building: string; }
export interface PayloadUnit { type: string; amount: number; }
export interface RecruitPayload extends SocketPayload {
  units: PayloadUnit[];
}
export type PayloadMovementUnit = [string, number];
export interface TroopMovementPayload extends SocketPayload {
  units: PayloadMovementUnit[];
  type: MovementType;
  target: Coords;
}

export class TownSocket {
  static onConnect(socket: UserSocket) {
    this.joinTownRoom(socket);

    socket.on('town:name', (payload: NamePayload) => this.changeName(socket, payload));
    socket.on('town:build', (payload: BuildPayload) => this.build(socket, payload));
    socket.on('town:recruit', (payload: RecruitPayload) => this.recruit(socket, payload));
    socket.on('town:moveTroops', (payload: TroopMovementPayload) => this.moveTroops(socket, payload));
    socket.on('town:update', (payload: SocketPayload) => this.update(socket, payload));
  }

  static joinTownRoom(socket: UserSocket) {
    socket.userData.townIds.forEach((id) => socket.join(String(id)));
  }

  private static changeName(socket: UserSocket, payload: NamePayload) {
    if (!payload.name || !payload.town) { return Promise.reject('Missing data'); }
    if (!socket.userData.townIds.includes(payload.town)) { return Promise.reject('No town found'); }

    return Town.getTown({ id: payload.town })
      .then((town): PromiseLike<Town> => {
        town.name = payload.name;
        return town.save();
      })
      .then((town) => town.notify({ type: 'name' }));
  }

  private static build(socket: UserSocket, payload: BuildPayload) {
    if (!payload.building || !payload.town) { return Promise.reject('Missing data'); }
    if (!socket.userData.townIds.includes(payload.town)) { return Promise.reject('No town found'); }

    const time = Date.now();
    return Town.getTown({ id: payload.town })
      .then((town) => this.tryBuilding(town, time, payload.building))
      .then((town) => town.notify({ type: 'build' }));
  }

  private static recruit(socket: UserSocket, payload: RecruitPayload) {
    if (!payload.units || !payload.town) { return Promise.reject('Missing data'); }
    if (!socket.userData.townIds.includes(payload.town)) { return Promise.reject('No town found'); }

    const time = Date.now();
    return Town.getTown({ id: payload.town})
      .then((town) => this.tryRecruiting(town, time, payload.units))
      .then((town) => town.notify({ type: 'recruit' }));
  }
  private static moveTroops(socket: UserSocket, payload: TroopMovementPayload) {
    if (!payload.town || !payload.target || !payload.type) { return; }
    if (!socket.userData.townIds.includes(payload.town)) { return Promise.reject('No town found'); }

    const time = Date.now();
    return Town.getTown({ id: payload.town })
      .then((town) => this.tryMoving(town, time, payload))
      .then((town) => town.notify({ type: 'movement' }));
  }

  private static tryBuilding(town: Town, time: number, building: string): PromiseLike<Town> {
    const target = town.buildings[building];
    if (target) {
      const level = target.queued || target.level;
      const targetBuilding = WorldDataService.buildingMap[building];
      const buildingData = targetBuilding.data[level];

      if (!buildingData) {
        return Promise.reject('Wrong building');
      }
      if (!town.checkBuildingRequirements(targetBuilding.requirements)) {
        return Promise.reject('Requirements not met');
      }

      town = town.updateRes(time);
      town.resources.clay -= buildingData.costs.clay;
      town.resources.wood -= buildingData.costs.wood;
      town.resources.iron -= buildingData.costs.iron;
      target.queued = level + 1;
      // trigger buildings change manully, because sequelize can't detect it
      town.changed('buildings', true);

      return world.sequelize.transaction((transaction) =>
        town.createBuildingQueue({
          building,
          buildTime: buildingData.buildTime,
          endsAt: time + buildingData.buildTime,
          level,
        }, { transaction })
          .then(() => town.save({ transaction })),
      );
    }
    // TODO: real error here
    return Promise.reject('target not found');
  }

  private static tryRecruiting(town: Town, time: number, units: PayloadUnit[]): PromiseLike<Town> {
    const unitData = WorldDataService.unitMap;
    const unitsToQueue = [];
    const queueCreateTime = new Date();
    const TownId = town.id;
    const availablePopulation = town.getAvailablePopulation();
    const recruitmentModifier = town.getRecruitmentModifier();
    let usedPop = 0;

    town = town.updateRes(time);
    for (const unit of units) {
      const targetUnit = unitData[unit.type];
      if (!town.units.hasOwnProperty(unit.type) || +unit.amount <= 0) {
        return Promise.reject('no such unit');
      }
      if (!town.checkBuildingRequirements(targetUnit.requirements)) {
        return Promise.reject('requirements not met');
      }
      usedPop += unit.amount;

      town.resources.wood -= targetUnit.costs.wood * unit.amount;
      town.resources.clay -= targetUnit.costs.clay * unit.amount;
      town.resources.iron -= targetUnit.costs.iron * unit.amount;
      town.units[unit.type].queued += unit.amount;

      const lastQueue = town.getLastQueue('UnitQueues');
      const startTime = lastQueue ? lastQueue.endsAt : queueCreateTime;
      const recruitTime = unit.amount * targetUnit.recruitTime * recruitmentModifier;
      const endsAt = startTime.getTime() + recruitTime;
      unitsToQueue.push({
        unit: unit.type,
        amount: unit.amount,
        recruitTime,
        endsAt,
        TownId,
      });
    }

    if (usedPop > availablePopulation) {
      return Promise.reject('Population limit exceeded');
    }

    town.changed('units', true);
    return world.sequelize.transaction((transaction) =>
      UnitQueue.bulkCreate(unitsToQueue, { transaction })
        .then(() => town.save({ transaction })),
    );
  }

  private static tryMoving(town: Town, time: number, payload: TroopMovementPayload): PromiseLike<Town> {
    const unitData = WorldDataService.unitMap;
    let slowest = 0;

    if (payload.target === town.location) { return Promise.reject('A town can\'t attack itself'); }

    return Town.findOne({ where: { location: payload.target } }).then((targetTown) => {
      const distance = Town.calculateDistance(town.location, targetTown.location);

      for (const unit of payload.units) {
        if (!town.units.hasOwnProperty(unit[0])) { return Promise.reject('No such unit'); }

        town.units[unit[0]].inside -= unit[1];
        town.units[unit[0]].outside += unit[1];
        slowest = Math.max(unitData[unit[0]].speed, slowest);
      }

      const movementTime = slowest * distance;
      town.changed('units', true);
      return world.sequelize.transaction((transaction) =>
        town.createMovementOriginTown({
          units: payload.units.reduce((result, [name, count]) => ({ ...result, [name]: count }), {}),
          type: payload.type,
          endsAt: time + movementTime,
          MovementDestinationId: targetTown.id,
        }, { transaction })
          .then(() => town.save({ transaction })),
      );
    });
  }
  private static update(socket: UserSocket, payload: SocketPayload) {
    if (!payload.town) { return Promise.reject('No town specified'); }

    const time = new Date();
    return Town.processTownQueues(payload.town, time)
      .then(({ town, processed }) => {
        const processedAttack = processed.some((queue) =>
          queue.constructor.name === 'Movement' && queue.type === 'attack');

        // TODO: handle town rooms on lose as well
        if (!processedAttack) { return town.notify({ type: 'update' }); }

        // Refresh whole player in case of a lost town
        return Player.getPlayer({ UserId: socket.userData.userId })
          .then((player) => {
            socket.userData = {
              ...socket.userData,
              townIds: player.Towns.map(({ id }) => id),
            };
            socket.emit('player', player);
          });
      });
  }
}
