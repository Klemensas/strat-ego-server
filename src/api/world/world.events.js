import { EventEmitter } from 'events';
import { world } from '../../sqldb';

const Player = world.Player;
const PlayerEvents = new EventEmitter();

// Set max event listeners (0 == unlimited)
PlayerEvents.setMaxListeners(0);

// Model events
const events = {
  afterCreate: 'save',
  afterUpdate: 'save',
  afterDestroy: 'remove',
};

// Register the event emitter to the model events
for (const e in events) {
  const event = events[e];
  Player.hook(e, emitEvent(event));
}

function emitEvent(event) {
  return (doc, options, done) => {
    PlayerEvents.emit(`${event}:${doc.id}`, doc);
    PlayerEvents.emit(event, doc);
    done(null);
  };
}

export default {
  player: PlayerEvents,
};
