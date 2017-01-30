const unitList = [
  {
    name: 'spear',
    costs: {
      wood: 50,
      clay: 30,
      iron: 10,
    },
    type: ['infantry'],
    speed: 1080,
    recruitTime: 1020,
    haul: 25,
    combat: {
      attack: 10,
      defense: {
        infantry: 15,
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
    type: ['infantry'],
    speed: 1320,
    recruitTime: 1500,
    haul: 15,
    combat: {
      attack: 25,
      defense: {
        infantry: 50,
        cavalry: 25,
        archer: 40,
      },
    },
    requirements: [{
      item: 'barracks',
      level: 2,
    }],
  }, {
    name: 'axe',
    costs: {
      wood: 60,
      clay: 30,
      iron: 40,
    },
    type: ['infantry'],
    speed: 1080,
    recruitTime: 1320,
    haul: 10,
    combat: {
      attack: 40,
      defense: {
        infantry: 10,
        cavalry: 5,
        archer: 10,
      },
    },
    requirements: [{
      item: 'barracks',
      level: 5,
    }],
  }, {
    name: 'archer',
    costs: {
      wood: 60,
      clay: 30,
      iron: 40,
    },
    type: ['infantry', 'archer'],
    speed: 1080,
    recruitTime: 1800,
    haul: 10,
    combat: {
      attack: 15,
      defense: {
        infantry: 50,
        cavalry: 40,
        archer: 5,
      },
    },
    requirements: [{
      item: 'barracks',
      level: 10,
    }],
  }, {
    name: 'scout',
    costs: {
      wood: 50,
      clay: 50,
      iron: 20,
    },
    type: ['cavalry'],
    speed: 540,
    recruitTime: 900,
    haul: 0,
    combat: {
      attack: 0,
      defense: {
        infantry: 2,
        cavalry: 1,
        archer: 2,
      },
    },
  }, {
    name: 'lightCavalry',
    costs: {
      wood: 125,
      clay: 100,
      iron: 250,
    },
    type: ['cavalry'],
    speed: 600,
    recruitTime: 1800,
    haul: 80,
    combat: {
      attack: 130,
      defense: {
        infantry: 30,
        cavalry: 40,
        archer: 30,
      },
    },
  }, {
    name: 'mountedArcher',
    costs: {
      wood: 250,
      clay: 100,
      iron: 150,
    },
    type: ['cavalry', 'archer'],
    speed: 600,
    recruitTime: 2700,
    haul: 50,
    combat: {
      attack: 120,
      defense: {
        infantry: 40,
        cavalry: 30,
        archer: 50,
      },
    },
  }, {
    name: 'heavyCavalry',
    costs: {
      wood: 200,
      clay: 150,
      iron: 600,
    },
    type: ['cavalry'],
    speed: 660,
    recruitTime: 3600,
    haul: 50,
    combat: {
      attack: 150,
      defense: {
        infantry: 200,
        cavalry: 80,
        archer: 180,
      },
    },
  }, {
    name: 'ram',
    costs: {
      wood: 300,
      clay: 200,
      iron: 200,
    },
    type: ['siege'],
    speed: 1800,
    recruitTime: 4800,
    haul: 0,
    combat: {
      attack: 2,
      defense: {
        infantry: 20,
        cavalry: 50,
        archer: 20,
      },
    },
  }, {
    name: 'catapult',
    costs: {
      wood: 320,
      clay: 400,
      iron: 100,
    },
    type: ['siege'],
    speed: 1800,
    recruitTime: 7200,
    haul: 0,
    combat: {
      attack: 100,
      defense: {
        infantry: 100,
        cavalry: 50,
        archer: 100,
      },
    },
  }, {
    name: 'noble',
    costs: {
      wood: 40000,
      clay: 50000,
      iron: 50000,
    },
    type: ['special'],
    speed: 2100,
    recruitTime: 18000,
    haul: 0,
    combat: {
      attack: 30,
      defense: {
        infantry: 100,
        cavalry: 50,
        archer: 100,
      },
    },
  },
];
export default (speed = 1, units = unitList) => units.map(unit => {
  unit.speed /= speed / 1000;
  unit.recruitTime /= speed / 1000;
  return unit;
});