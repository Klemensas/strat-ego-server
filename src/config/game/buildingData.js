const buildingList = [
  {
    name: 'headquarters',
    levels: 30,
    min: 1,
    costs: {
      wood: {
        base: 90,
        factor: 1.26,
      },
      clay: {
        base: 80,
        factor: 1.275,
      },
      iron: {
        base: 70,
        factor: 1.26,
      },
    },
    baseTime: 20,
    timeFactor: 1.2,
  }, {
    name: 'barracks',
    levels: 25,
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
    additional: {
      defense: {
        base: 0,
        factor: 0,
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
    additional: {
      population: {
        base: 240,
        factor: 1.172103,
      },
    },
  },
];

export const buildingData = (buildings = buildingList) => buildings.map(building => {
  const item = {
    name: building.name,
    levels: { max: building.levels, min: building.min },
    data: [],
  };

  for (let i = 0; i <= item.levels.max; i++) {
    const data = {
      buildTime: Math.ceil(building.baseTime * Math.pow(building.timeFactor, i)),
      costs: {
        wood: Math.ceil(building.costs.wood.base * Math.pow(building.costs.wood.factor, i)),
        clay: Math.ceil(building.costs.clay.base * Math.pow(building.costs.clay.factor, i)),
        iron: Math.ceil(building.costs.iron.base * Math.pow(building.costs.iron.factor, i)),
      },
    };
    if (building.additional) {
      for (const key in building.additional) {
        if (building.additional.hasOwnProperty(key)) {
          const factor = !!i ? Math.pow(building.additional[key].factor, i - 1) : 0;
          data[key] = Math.ceil(building.additional[key].base * factor);
        }
      }
    }
    item.data.push(data);
  }
  return item;
});
