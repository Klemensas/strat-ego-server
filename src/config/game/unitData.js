export const unitData = [
  {
    name: 'spear',
    costs: {
      wood: 50,
      clay: 30,
      iron: 10,
    },
    type: ['infantry'],
    speed: 18,
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
    speed: 22,
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
    speed: 18,
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
    speed: 18,
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
    speed: 9,
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
    speed: 10,
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
    speed: 10,
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
    speed: 11,
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
    speed: 30,
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
    speed: 30,
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
    speed: 35,
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
