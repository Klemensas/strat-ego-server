import { Unit } from '../../src/api/unit/unit';
import { User } from '../../src/api/user/user';
import { Town } from '../../src/api/town/town';
import { Player } from '../../src/api/player/player';
import { World } from '../../src/api/world/world';
import { Building } from '../../src/api/building/building';
import { worldData } from '../../src/api/world/worldData';
import { unitData } from '../../src/config/game/unitData';
import { buildingData } from '../../src/config/game/buildingData';

const mapSize = Math.ceil(999 / 2);
function getRingCoords(size, ring) {
  const min = size - ring;
  const max = size + ring;
  const halfRing = Math.floor(ring / 2);

  const xLeft = [min, size];
  const xRight = [max, size];
  const top = [];
  const bottom = [];
  const leftTop = [];
  const leftBottom = [];
  const rightTop = [];
  const rightBottom = [];

  for (let i = 0; i < ring + 1; i++) {
    const x = min + halfRing + i;
    top.push([x, min]);
    bottom.push([x, max]);
    if (i < ring - 1) {
      const yT = size - 1 - i;
      const yB = size + 1 + i;
      const xL = min + Math.floor((i + 1) / 2);
      const xR = max - Math.round((1 + i) / 2);
      leftTop.unshift([xL, yT]);
      rightTop.unshift([xR, yT]);
      leftBottom.push([xL, yB]);
      rightBottom.push([xR, yB]);
    }
  }

  return {
    left: [...leftTop, xLeft, ...leftBottom],
    right: [...rightTop, xRight, ...rightBottom],
    top,
    bottom,
  };
}

function getCoordsInRange(rings, furthestRing, size) {
  const coords = getRingCoords(size, furthestRing);
  const innards = coords.left.reduce((p, c, i, a) => {
    const right = coords.right[i];
    if (i >= rings - 1 && i <= a.length - rings) {
      return [
        ...p,
        ...Array.from({ length: rings }, (v, j) => [c[0] + j, c[1]]),
        ...Array.from({ length: rings }, (v, j) => [right[0] - j, right[1]]),
      ];
    }
    const rowLength = right[0] - c[0] + 1;
    return [
      ...p,
      ...Array.from({ length: rowLength }, (v, j) => [c[0] + j, c[1]]),
    ];
  }, []);
  return [...coords.top, ...innards, ...coords.bottom];
}

export const seed = (
  knex,
  demoUsers: User[],
  world: World,
  maxTowns = 5,
  townRate = 0.4,
  speed = 1,
  baseProduction = 30,
  townPercent = 0.6,
  townArea = 5,
  townDistance = 5,
) => Unit.query(knex).del()
  .then(() => Unit.query(knex).insert(unitData(speed)))
  .then(() => Building.query(knex).del())
  .then(() => Building.query(knex).insert(buildingData(speed)))
  .then(() => worldData.initialize(world.name))
  .then(() => Town.query(knex).del())
  .then(async () => {
    const coords = getCoordsInRange(townArea, townDistance, mapSize);
    const factor = townPercent;
    const name = 'Abandoned Town';
    return Town.query(knex).insert(coords.reduce((towns, location) => {
      if (Math.random() <= factor) { towns.push({
        location,
        name,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }); }
      return towns;
    }, []));
  })
  .then(async (towns: Town[]) => {
    await Player.query(knex).del();

    let townIndex = 0;
    const availableTowns = towns.map(({ id }) => id);
    const players = demoUsers.map((user, index) => {
      let assignedTowns = [];
      // Alays assign owns to special users
      if (index < 2) {
        assignedTowns = availableTowns.slice(0, 2).map((id) => ({ id }));
        towns[townIndex].playerId = user.id;
        towns[townIndex + 1].playerId = user.id;
        townIndex += 2;
      } else {
        for (let i = 0; i < maxTowns && availableTowns.length > i; i++) {
          const shouldAssign = Math.random() <= townRate;
          if (shouldAssign) {
            assignedTowns.push({ id: availableTowns[i] });
            towns[townIndex].playerId = user.id;
            townIndex++;
          }
        }
      }
      availableTowns.splice(0, assignedTowns.length);
      return {
        userId: user.id,
        name: user.name,
        towns: assignedTowns,
      };
    });
    await Player.query(knex).upsertGraph(players, { relate: true });
    return { players, towns };
  });
