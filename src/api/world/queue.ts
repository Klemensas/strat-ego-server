import { Movement } from '../town/movement';
import { Town } from '../town/town';
import { BuildingQueue } from '../building/buildingQueue';
import { UnitQueue } from '../unit/unitQueue';

class Queue {
  public interval;

  constructor(interval: number = 30000) {
    this.interval = interval;
  }

  go() {
    const time = Date.now();
    const touchedTowns = [];
    Town.findAll({
      order: [[{ model: Movement, as: 'MovementDestinationTown' }, 'endsAt', 'ASC' ]],
      include: [{
        model: BuildingQueue,
        as: 'BuildingQueues',
        where: { endsAt: { $lt: time } },
        required: false,
      }, {
        model: UnitQueue,
        as: 'UnitQueues',
        where: { endsAt: { $lt: time } },
        required: false,
      }, {
        model: Movement,
        as: 'MovementDestinationTown',
        where: { endsAt: { $lt: time } },
      }],
    }).then((towns) => {
      console.log('Queue update started', Date.now());
      return Promise.all(towns.map((town) => {
        const queues = [
          ...town.BuildingQueues,
          ...town.UnitQueues,
          ...town.MovementDestinationTown,
        ]
        .sort((a, b) => a.endsAt.getTime() - b.endsAt.getTime());
        return town.process(queues);
      }));
    }).then(() => {
      console.log('Queue update started', Date.now());
    }).catch((error) => {
      console.log('surprising error!', error);
    });
  }
}

const queue = new Queue();
export default queue;
