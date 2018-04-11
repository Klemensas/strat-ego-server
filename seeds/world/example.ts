import { Unit } from '../../src/api/unit/unit';
import { User } from '../../src/api/user/user';
import { Town } from '../../src/api/town/town';
import { Player } from '../../src/api/player/player';
import { World } from '../../src/api/world/world';
import { Building } from '../../src/api/building/building';
import { worldData } from '../../src/api/world/worldData';

const unitList: Array<Partial<Unit>> = [
  {
    name: 'axe',
    costs: {
      wood: 50,
      clay: 30,
      iron: 10,
    },
    attackType: 'general',
    speed: 1080,
    recruitTime: 1020,
    haul: 25,
    combat: {
      attack: 10,
      defense: {
        general: 15,
        cavalry: 45,
        archer: 20,
      },
    },
  }, {
    name: 'sword',
    costs: {
      wood: 30,
      clay: 30,
      iron: 70,
    },
    attackType: 'general',
    speed: 1320,
    recruitTime: 1500,
    haul: 15,
    combat: {
      attack: 25,
      defense: {
        general: 50,
        cavalry: 25,
        archer: 40,
      },
    },
    requirements: [{
      item: 'barracks',
      level: 2,
    }],
  }, {
    name: 'mace',
    costs: {
      wood: 60,
      clay: 30,
      iron: 40,
    },
    attackType: 'general',
    speed: 1080,
    recruitTime: 1320,
    haul: 10,
    combat: {
      attack: 40,
      defense: {
        general: 10,
        cavalry: 5,
        archer: 10,
      },
    },
    requirements: [{
      item: 'barracks',
      level: 4,
    }],
  }, {
    name: 'archer',
    costs: {
      wood: 60,
      clay: 30,
      iron: 40,
    },
    attackType: 'archer',
    speed: 1080,
    recruitTime: 1800,
    haul: 10,
    combat: {
      attack: 15,
      defense: {
        general: 50,
        cavalry: 40,
        archer: 5,
      },
    },
    requirements: [{
      item: 'barracks',
      level: 6,
    }],
  },
  // {
  //   name: 'scout',
  //   costs: {
  //     wood: 50,
  //     clay: 50,
  //     iron: 20,
  //   },
  //   attackType: 'cavalry',
  //   speed: 540,
  //   recruitTime: 900,
  //   haul: 0,
  //   combat: {
  //     attack: 0,
  //     defense: {
  //       general: 2,
  //       cavalry: 1,
  //       archer: 2,
  //     },
  //   },
  // },
  {
    name: 'lightCavalry',
    costs: {
      wood: 125,
      clay: 100,
      iron: 250,
    },
    attackType: 'cavalry',
    speed: 600,
    recruitTime: 1800,
    haul: 80,
    combat: {
      attack: 130,
      defense: {
        general: 30,
        cavalry: 40,
        archer: 30,
      },
    },
    requirements: [{
      item: 'barracks',
      level: 10,
    }],
  }, {
    name: 'mountedArcher',
    costs: {
      wood: 250,
      clay: 100,
      iron: 150,
    },
    attackType: 'archer',
    speed: 600,
    recruitTime: 2700,
    haul: 50,
    combat: {
      attack: 120,
      defense: {
        general: 40,
        cavalry: 30,
        archer: 50,
      },
    },
    requirements: [{
      item: 'barracks',
      level: 10,
    }],
  }, {
    name: 'heavyCavalry',
    costs: {
      wood: 200,
      clay: 150,
      iron: 600,
    },
    attackType: 'cavalry',
    speed: 660,
    recruitTime: 3600,
    haul: 50,
    combat: {
      attack: 150,
      defense: {
        general: 200,
        cavalry: 80,
        archer: 180,
      },
    },
    requirements: [{
      item: 'barracks',
      level: 15,
    }],
  }, {
    name: 'trebuchet',
    costs: {
      wood: 300,
      clay: 200,
      iron: 200,
    },
    attackType: 'general',
    speed: 1800,
    recruitTime: 4800,
    haul: 0,
    combat: {
      attack: 200,
      defense: {
        general: 20,
        cavalry: 50,
        archer: 20,
      },
    },
    requirements: [{
      item: 'barracks',
      level: 15,
    }],
  // }, {
  //   name: 'catapult',
  //   costs: {
  //     wood: 320,
  //     clay: 400,
  //     iron: 100,
  //   },
  //   attackType: 'general',
  //   speed: 1800,
  //   recruitTime: 7200,
  //   haul: 0,
  //   combat: {
  //     attack: 100,
  //     defense: {
  //       general: 100,
  //       cavalry: 50,
  //       archer: 100,
  //     },
  //   },
  }, {
    name: 'noble',
    costs: {
      wood: 40000,
      clay: 50000,
      iron: 50000,
    },
    attackType: 'general',
    speed: 2100,
    recruitTime: 18000,
    haul: 0,
    combat: {
      attack: 30,
      defense: {
        general: 100,
        cavalry: 50,
        archer: 100,
      },
    },
    requirements: [{
      item: 'castle',
      level: 1,
    }],
  }, {
    name: 'commander',
    costs: {
      wood: 100,
      clay: 100,
      iron: 100,
    },
    attackType: 'general',
    speed: 600,
    recruitTime: 18000,
    haul: 100,
    combat: {
      attack: 200,
      defense: {
        general: 100,
        cavalry: 100,
        archer: 100,
      },
    },
    requirements: [{
      item: 'barracks',
      level: 20,
    }],
  },
];

const buildingList: any = [
  {
    name: 'headquarters',
    levels: 15,
    min: 1,
    costs: {
      wood: {
        base: 90,
        factor: 1.56,
      },
      clay: {
        base: 80,
        factor: 1.575,
      },
      iron: {
        base: 70,
        factor: 1.56,
      },
    },
    baseTime: 20,
    timeFactor: 1.4,
    baseScore: 30,
    scoreFactor: 1.75,
  }, {
    name: 'barracks',
    levels: 20,
    min: 0,
    costs: {
      wood: {
        base: 200,
        factor: 1.26,
      },
      clay: {
        base: 170,
        factor: 1.28,
      },
      iron: {
        base: 90,
        factor: 1.26,
      },
    },
    baseTime: 30,
    timeFactor: 1.2,
    baseScore: 20,
    scoreFactor: 1.6,
    additional: {
      recruitment: {
        base: 1,
        factor: 0.96,
      },
    },
    requirements: [{
      item: 'headquarters',
      level: 3,
    }],
  }, {
    name: 'wood',
    levels: 30,
    min: 0,
    costs: {
      wood: {
        base: 50,
        factor: 1.25,
      },
      clay: {
        base: 60,
        factor: 1.275,
      },
      iron: {
        base: 40,
        factor: 1.245,
      },
    },
    baseTime: 15,
    timeFactor: 1.2,
    baseScore: 14,
    scoreFactor: 1.4,
    additional: {
      production: {
        base: 30,
        factor: 1.163118,
      },
    },
  }, {
    name: 'clay',
    levels: 30,
    min: 0,
    costs: {
      wood: {
        base: 65,
        factor: 1.27,
      },
      clay: {
        base: 50,
        factor: 1.265,
      },
      iron: {
        base: 40,
        factor: 1.24,
      },
    },
    baseTime: 15,
    timeFactor: 1.2,
    baseScore: 14,
    scoreFactor: 1.4,
    additional: {
      production: {
        base: 30,
        factor: 1.163118,
      },
    },
  }, {
    name: 'iron',
    levels: 30,
    min: 0,
    costs: {
      wood: {
        base: 75,
        factor: 1.252,
      },
      clay: {
        base: 65,
        factor: 1.275,
      },
      iron: {
        base: 70,
        factor: 1.24,
      },
    },
    baseTime: 18,
    timeFactor: 1.2,
    baseScore: 14,
    scoreFactor: 1.4,
    additional: {
      production: {
        base: 30,
        factor: 1.163118,
      },
    },
  }, {
    name: 'wall',
    levels: 20,
    min: 0,
    costs: {
      wood: {
        base: 50,
        factor: 1.26,
      },
      clay: {
        base: 100,
        factor: 1.275,
      },
      iron: {
        base: 20,
        factor: 1.24,
      },
    },
    baseTime: 60,
    timeFactor: 1.2,
    baseScore: 10,
    scoreFactor: 1.5,
    additional: {
      defense: {
        base: 1.04,
        factor: 1.04,
      },
    },
  }, {
    name: 'storage',
    levels: 30,
    min: 1,
    costs: {
      wood: {
        base: 60,
        factor: 1.265,
      },
      clay: {
        base: 50,
        factor: 1.27,
      },
      iron: {
        base: 40,
        factor: 1.245,
      },
    },
    baseTime: 17,
    timeFactor: 1.2,
    baseScore: 13,
    scoreFactor: 1.44,
    additional: {
      storage: {
        base: 1000,
        factor: 1.2294934,
      },
    },
  }, {
    name: 'farm',
    levels: 30,
    min: 1,
    costs: {
      wood: {
        base: 45,
        factor: 1.3,
      },
      clay: {
        base: 40,
        factor: 1.32,
      },
      iron: {
        base: 30,
        factor: 1.29,
      },
    },
    baseTime: 20,
    timeFactor: 1.2,
    baseScore: 16,
    scoreFactor: 1.38,
    additional: {
      population: {
        base: 240,
        factor: 1.172103,
      },
    },
  }, {
    name: 'castle',
    levels: 1,
    min: 0,
    costs: {
      wood: {
        base: 15000,
      },
      clay: {
        base: 25000,
      },
      iron: {
        base: 10000,
      },
    },
    baseTime: 14400,
    timeFactor: 1,
    baseScore: 300,
    scoreFactor: 2,
    requirements: [{
      item: 'headquarters',
      level: 15,
    }],
  },
];
function generateBuildings(speed, list = buildingList) {
  return list.map((building) => {
    const item = {
      name: building.name,
      levels: { max: building.levels, min: building.min },
      requirements: building.requirements,
      data: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    for (let i = 0; i <= item.levels.max; i++) {
      const data = {
        buildTime: Math.ceil((building.baseTime * (building.timeFactor ** i)) / speed) * 1000,
        costs: {
          wood: Math.ceil(building.costs.wood.base * (building.costs.wood.factor ** i)),
          clay: Math.ceil(building.costs.clay.base * (building.costs.clay.factor ** i)),
          iron: Math.ceil(building.costs.iron.base * (building.costs.iron.factor ** i)),
        },
        score:  Math.ceil(building.baseScore * (building.scoreFactor ** i)),
      };
      if (building.additional) {
        Object.entries(building.additional).forEach(([key, value]: any) => {
          const factor = i ? value.factor ** (i - 1) : 0;
          let base = value.base;
          data[key] = +(base * factor).toPrecision(3);
          if (key === 'production') {
            base *= speed;
            data[key] = Math.ceil(data[key]);
          }
        });
      }
      item.data.push(data);
    }
    return item;
  });
}

const townGenerationData = {
  percent: 0.6,
  furthestRing: 13,
  area: 13,
  size: Math.ceil(999 / 2),
};
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

export const seed = (knex, demoUsers: User[], world: World, maxTowns = 5, townRate = 0.4, speed = 1, baseProduction = 30) =>
  Unit.query(knex).del().then(() => Unit.query(knex).insert(unitList.map((unit) => {
    unit.speed /= speed / 1000;
    unit.recruitTime /= speed / 1000;
    unit.createdAt = Date.now();
    unit.updatedAt = Date.now();
    return unit;
  })))
  .then(() => Building.query(knex).del())
  .then(() => Building.query(knex).insert(generateBuildings(speed)))
  .then(() => worldData.readWorld(world.name))
  .then(() => Town.query(knex).del())
  .then(() => {
    const coords = getCoordsInRange(townGenerationData.area, townGenerationData.furthestRing, townGenerationData.size);
    const factor = townGenerationData.percent;
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

    const players = demoUsers.map((user, index) => {
      const assignedTowns = [];
      for (let i = 0; i < maxTowns && towns.length > i; i++) {
        const shouldAssign = Math.random() <= townRate;
        if (shouldAssign) {
          assignedTowns.push({ id: towns[i].id });
        }
      }
      towns.splice(0, assignedTowns.length);
      return {
        userId: user.id,
        name: user.name,
        towns: assignedTowns,
      };
    });
    return Player.query(knex).upsertGraph(players, { relate: true });

  });
