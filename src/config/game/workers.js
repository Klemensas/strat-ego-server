const kitchenWorkers = {
  'burger flipper': {
    costs: {
      megabucks: 5,
      burgers: 1,
      fries: 4,
      drinks: 4,
      loyals: 2,
    },
    requires: {
      kitchen: 2,
    },
    buildTime: 600,
  },
  'fry fryer': {
    costs: {
      megabucks: 5,
      burgers: 4,
      fries: 1,
      drinks: 4,
      loyals: 2,
    },
    requires: {
      kitchen: 2,
    },
    buildTime: 600,
  },
  'drink pourer': {
    costs: {
      megabucks: 5,
      burgers: 4,
      fries: 4,
      drinks: 1,
      loyals: 2,
    },
    requires: {
      kitchen: 2,
    },
    buildTime: 600,
  },
  'server': {
    costs: {
      megabucks: 10,
      burgers: 10,
      fries: 10,
      drinks: 10,
      loyals: 1,
    },
    requires: {
      kitchen: 5,
    },
    buildTime: 600,
  },
};
const outsideWorkers = {
  'bouncer': {
    costs: {
      megabucks: 4,
      burgers: 20,
      fries: 8,
      drinks: 10,
      loyals: 2,
    },
    requires: {
      kitchen: 5,
    },
    speed: 10,
    combat: {
      attack: 2,
      defense: 10,
    },
    buildTime: 900,
  },
  'mobster': {
    costs: {
      megabucks: 10,
      burgers: 17,
      fries: 30,
      drinks: 10,
      loyals: 4,
    },
    requires: {
      kitchen: 5,
    },
    speed: 20,
    combat: {
      attack: 20,
      defense: 50,
    },
    buildTime: 2100,
  },
  'punk': {
    costs: {
      megabucks: 3,
      burgers: 10,
      fries: 12,
      drinks: 15,
      loyals: 2,
    },
    requires: {
      kitchen: 5,
    },
    speed: 20,
    combat: {
      attack: 10,
      defense: 3,
    },
    buildTime: 700,
  },
  'thug': {
    costs: {
      megabucks: 8,
      burgers: 22,
      fries: 22,
      drinks: 10,
      loyals: 5,
    },
    requires: {
      kitchen: 5,
    },
    speed: 25,
    combat: {
      attack: 40,
      defense: 10,
    },
    buildTime: 1800,
  },
  'spy': {
    costs: {
      megabucks: 100,
      burgers: 20,
      fries: 20,
      drinks: 20,
      loyals: 10,
    },
    requires: {
      kitchen: 7,
    },
    speed: 25,
    combat: {
      attack: 0,
      defense: 0,
    },
    buildTime: 1000,
  },
  'inspector': {
    costs: {
      megabucks: 500,
      burgers: 100,
      fries: 80,
      drinks: 50,
      loyals: 20,
    },
    requires: {
      kitchen: 7,
    },
    speed: 10,
    combat: {
      attack: 30,
      defense: 10,
    },
    buildTime: 3000,
  },
  'corrupt official': {
    costs: {
      megabucks: 2000,
      burgers: 4000,
      fries: 5000,
      drinks: 4000,
      loyals: 100,
    },
    requires: {
      kitchen: 7,
    },
    speed: 10,
    combat: {
      attack: 5,
      defense: 5,
    },
    buildTime: 6000,
  },
};
const resAffectedBy = {
  burgers: 'burger flipper',
  fries: 'fry fryer',
  drinks: 'drink pourer',
  loyals: 'server',
};

const defaultWorkers = {
  kitchen: [{
    title: 'burger flipper',
    count: 0,
  }, {
    title: 'fry fryer',
    count: 0,
  }, {
    title: 'drink pourer',
    count: 0,
  }, {
    title: 'server',
    count: 0,
  },
  ],
  outside: [{
    title: 'bouncer',
    count: 0,
  }, {
    title: 'mobster',
    count: 0,
  }, {
    title: 'punk',
    count: 0,
  }, {
    title: 'thug',
    count: 0,
  }, {
    title: 'spy',
    count: 0,
  }, {
    title: 'inspector',
    count: 0,
  }, {
    title: 'corrupt official',
    count: 0,
  }],
};


const workerTypes = [
  'burger flipper',
  'fry fryer',
  'drink pourer',
  'server',
  'bouncer',
  'mobster',
  'punk',
  'thug',
  'spy',
  'inspector',
  'corrupt official',
];

export { resAffectedBy, defaultWorkers };
export default {
  allWorkers: Object.assign({}, outsideWorkers, kitchenWorkers),
  kitchenWorkerArray: Object.keys(kitchenWorkers).map(key => { kitchenWorkers[key].title = key; return kitchenWorkers[key]; }),
  outsideWorkerArray: Object.keys(outsideWorkers).map(key => { outsideWorkers[key].title = key; return outsideWorkers[key]; }),
  defaultWorkers,
  kitchenWorkers,
  outsideWorkers,
  resAffectedBy,
  workerTypes,
};

