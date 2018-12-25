import { Unit } from '../../api/unit/unit';

export const unitList: Array<Partial<Unit>> = [
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
    farmSpace: 1,
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
    farmSpace: 1,
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
    farmSpace: 1,
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
    farmSpace: 1,
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
  // farmSpace: 4,
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
    farmSpace: 5,
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
    farmSpace: 6,
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
    farmSpace: 8,
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
    farmSpace: 15,
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
  // farmSpace: 20,
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
    farmSpace: 100,
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
    farmSpace: 50,
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

export function unitData(speed = 1, date = Date.now(), units = unitList) {
  return units.map((unit) => {
    unit.speed /= speed / 1000;
    unit.recruitTime /= speed / 1000;
    unit.createdAt = date;
    unit.updatedAt = date;
    return unit;
  });
}
