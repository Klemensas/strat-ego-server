interface IBuilding {
  name: string;
  levels: number;
  min: number;
  costs: {
    wood: { base: number; factor?: number; };
    clay: { base: number; factor?: number; };
    iron: { base: number; factor?: number; };
  };
  baseTime: number;
  timeFactor: number;
  scoreBase: number;
  scoreFactor: number;
  additional?: {
    [key: string]: {
      base: number;
      factor: number;
    };
  };
  requirements?: [{
    item: string;
    level: number;
  }];
}

const buildingList: IBuilding[] = [
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
    scoreBase: 4,
    scoreFactor: 1.4,
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
    scoreBase: 4,
    scoreFactor: 1.4,
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
    scoreBase: 4,
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
    scoreBase: 4,
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
    scoreBase: 4,
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
    scoreBase: 4,
    scoreFactor: 1.4,
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
    scoreBase: 4,
    scoreFactor: 1.4,
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
    scoreBase: 4,
    scoreFactor: 1.4,
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
    scoreBase: 4,
    scoreFactor: 1.4,
    requirements: [{
      item: 'headquarters',
      level: 15,
    }],
  },
];

export default (speed = 1, buildings = buildingList) => buildings.map((building) => {
  const item = {
    name: building.name,
    levels: { max: building.levels, min: building.min },
    requirements: building.requirements,
    data: [],
  };

  for (let i = 0; i <= item.levels.max; i++) {
    const data = {
      score: Math.ceil(building.scoreBase * (building.scoreFactor ** i)),
      buildTime: Math.ceil((building.baseTime * (building.timeFactor ** i)) / speed) * 1000,
      costs: {
        wood: Math.ceil(building.costs.wood.base * (building.costs.wood.factor ** i)),
        clay: Math.ceil(building.costs.clay.base * (building.costs.clay.factor ** i)),
        iron: Math.ceil(building.costs.iron.base * (building.costs.iron.factor ** i)),
      },
    };
    if (building.additional) {
      Object.entries(building.additional).forEach(([key, value]) => {
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
