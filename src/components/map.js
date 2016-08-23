import sqldb from '../sqldb';

const Restaurant = sqldb.world.Restaurant;
generateRestaurant(500, 4, 3)

function generateRestaurant(size, currentRim, radius, name = 'Government restaurant') {
  getAvailableCoords(getCoordsInRange(radius, currentRim, size))
    .then(coords => {
      const location = coords[Math.round(Math.random() * coords.length)];
      Restaurant.create({
        name,
        location,
      })
    });
}

function getAvailableCoords(allCoords) {
  let availableCoords = allCoords;
  return Restaurant.sync()
    .then(() => Restaurant.findAll({
      attributes: ['location'],
      where: {
        location: {
          $in: [...allCoords]
        }
      },
      raw: true
    }))
    .then(res => {
      const usedLocations = res.map(i => i.location.join(','));
      return availableCoords.filter(c => !usedLocations.includes(c.join(',')));
    });
}

function getCoordsInRange(rings, furthestRing, size) {
  const coords = getRingCoords(size, furthestRing);
  const innards = coords.left.reduce((p, c, i, a) => {
    const right = coords.right[i];
    if (i >= rings - 1 && i <= a.length - rings) {
      return [
        ...p,
        ...Array.from({ length: rings }, (v, i) => [c[0] + i, c[1]]),
        ...Array.from({ length: rings}, (v, i) => [right[0] - i, right[1]])
      ];
    }
    const rowLength = right[0] - c[0] + 1;
    return [
      ...p,
      ...Array.from({ length: rowLength }, (v, i) => [c[0] + i, c[1]])
    ];
  }, []);
  return [...coords.top, ...innards, ...coords.bottom];
}

function getRingCoords(size, ring) {
  const minY = size - ring;
  const maxY = size + ring;
  const minX = size - ring;
  const maxX = size + ring;
  const halfRing = Math.floor(ring / 2)
  
  const xLeft = [minX, size];
  const xRight = [maxX, size];
  let top = [];
  let bottom = [];
  let leftTop = [];
  let leftBottom = [];
  let rightTop = [];
  let rightBottom = [];
  
  for (var i = 0; i < ring + 1; i++) {
    const x = minX + halfRing + i;
    top.push([x, minY]);
    bottom.push([x, maxY]);
    if (i < ring - 1) {
      const yT = size - 1 - i;
      const yB = size + 1 + i;
      const xL = minX + Math.floor((i + 1) / 2);
      const xR = maxX - Math.round((1 + i) / 2);
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
    bottom
  };
}
