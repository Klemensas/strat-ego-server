const defaultBuildings = [{
  title: 'headquarters',
  level: 1,
}, {
  title: 'storage',
  level: 1,
}, {
  title: 'cellar',
  level: 1,
}, {
  title: 'kitchen',
  level: 1,
}, {
  title: 'chairs',
  level: 0,
}, {
  title: 'training',
  level: 0,
}, {
  title: 'interior',
  level: 0,
}];

const costs = {
  headquarters: [
    [0, 0, 0, 0, 0],
    [40, 10, 10, 10, 2],
    [75, 15, 15, 15, 5],
  ],
  storage: [
    [0, 0, 0, 0, 0],
    [20, 5, 5, 5, 1],
    [50, 8, 8, 8, 3],
  ],
  cellar: [
    [0, 0, 0, 0, 0],
    [20, 5, 5, 5, 1],
    [50, 8, 8, 8, 3],
  ],
  kitchen: [
    [0, 0, 0, 0, 0],
    [30, 10, 10, 10, 0],
    [60, 10, 10, 10, 2],
    [100, 15, 15, 20, 5],
    [160, 20, 20, 40, 10],
    [250, 60, 60, 100, 25],
    [20000, 8800, 7500, 8000, 200],
  ],
  chairs: [
    [10, 0, 0, 0, 0],
    [20, 7, 7, 7, 1],
    [50, 16, 16, 16, 2],
  ],
  training: [
    [10, 5, 3, 3, 0],
    [25, 11, 6, 6, 5],
    [54, 20, 11, 11, 20],
  ],
  interior: [
    [10, 0, 0, 0, 0],
    [19, 10, 14, 10, 6],
    [40, 16, 20, 16, 18],
  ],
};

const buildTimes = {
  headquarters: [
    20,
    95,
    205,
  ],
  storage: [
    10,
    50,
    190,
  ],
  cellar: [
    10,
    50,
    190,
  ],
  kitchen: [
    15,
    70,
    150,
    320,
    1000,
    2500,
    6000,
  ],
  chairs: [
    10,
    40,
    150,
    400,
  ],
  training: [
    20,
    60,
    180,
  ],
  interior: [
    12,
    45,
    200,
  ],
};

const points = {
  headquarters: [
    20,
    25,
    32,
    40,
  ],
  storage: [
    10,
    13,
    18,
    25,
  ],
  cellar: [
    10,
    13,
    18,
    25,
  ],
  kitchen: [
    15,
    19,
    27,
    40,
    55,
    80,
    200,
  ],
  chairs: [
    5,
    8,
    12,
    20,
    32,
  ],
  training: [
    20,
    60,
    180,
  ],
  interior: [
    12,
    45,
    200,
  ],
};

const requirements = {
  headquarters: null,
  storage: null,
  cellar: null,
  kitchen: null,
  chairs: null,
  training: {
    headquarters: 3,
    interior: 1,
  },
  interior: {
    headquarters: 3,
  },
};

const details = {
  headquarters: 'Every operation in your restaurant goes through your headquarters. Your HQ reduces build time. Higher level HQ allows building more buildings.',
  storage: 'Storage is used for storring all of the resources your restaurant holds. Strangely enough your money is stored here as well. Upgrading it increases the maximum amount you can store.',
  cellar: 'Your workers are housed in your cellar due to high living costs of Megapolis. Upgrading the cellar increases maximum amount of workers you can have.',
  kitchen: 'The kitchen holds all of your equipment and upgrading it increases your base production of all goods.',
  chairs: 'The seating area of your restaurant determines how many total loyal clients can you seat.',
  training: 'You send your loyal clients to the training room, some unspeakable things happen inside and you have new workers! The higher the level the faster they come out as workers.',
  interior: 'While seemingly useless to you, the interior of your restaurant is very important to your workers. Upgrade it to unlock more worker types.',
};

const resources = ['megabucks', 'burgers', 'fries', 'drinks', 'loyals'];

const stored = [
  400,
  496,
  615,
  762,
  944,
  1170
]

function levelCosts(building, level) {
  return typeof costs[building] !== 'undefined' ? costs[building][level] : undefined;
}

function arrayToObject(arr, names) {
  return arr.reduce((p, c, i) => {
    p[names[i]] = c;
    return p;
  }, {});
}

// TODO: Currently resources are hard coded, maybe take the restaurant schema for them?
function toObject(target, names) {
  if (target.constructor === Object) {
    const keys = Object.keys(target);
    let res = {};
    keys.map(k => {
      res[k] = target[k].map(a => arrayToObject(a, names));
      return res;
    });
    return res;
  } else if (typeof target[0] !== 'object') {
    return arrayToObject(target, names);
  }
  return target.map((a) => arrayToObject(a, names));
}

function levelCostsNamed(building, level) {
  const costArray = levelCosts(building, level);
  return toObject(costArray, resources);
}

export default {
  buildTimes,
  costs,
  defaultBuildings,
  details,
  levelCosts,
  levelCostsNamed,
  points,
  requirements,
  resources,
  stored,
  costsNamed: toObject(costs, resources),
};

