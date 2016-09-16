import workers from '../../config/game/workers';
import { Town, updateRes } from '../town/town.model';
import { sendMovementEvent } from '../town/town.controller';
import buildings from '../../config/game/buildings';
import events from '../../components/events';
import _ from 'lodash';

// Gets worker data
export function index(req, res) {
  return res.json({
    allWorkers: workers.allWorkers,
    kitchenWorkers: workers.kitchenWorkerArray,
    outsideWorkers: workers.outsideWorkerArray,
    outsideWorkerMap: workers.outsideWorkers,
  });
}

function isOwner(user, townId) {
  return user.gameData.towns.some(r => r.equals(townId));
}

function handleEntityNotFound(res) {
  return function (entity) {
    if (!entity) {
      res.status(404).end();
      return null;
    }
    return entity;
  };
}

// Add worker to user Town
export function hireWorkers(req, res) {
  const data = req.body;
  if (data.rest && isOwner(req.user, data.rest) && data.workers) {
    const filteredUnits = Object.keys(data.workers).filter(t => !!workers.allWorkers[t] && Number(data.workers[t]) > 0);
    if (filteredUnits.length) {
      return Town.findById(data.rest)
        .then(handleEntityNotFound(res))
          .then(rest => {
            const costs = {
              megabucks: 0,
              burgers: 0,
              fries: 0,
              drinks: 0,
              loyals: 0,
            };
            const canBuild = filteredUnits.every(t => {
              const workerData = workers.allWorkers[t];
              Object.keys(workerData.costs).forEach(k => costs[k] += workerData.costs[k] * data.workers[t]);
              return Object.keys(workerData.requires).every(k => rest.buildings.find(b => b.title === k).level >= workerData.requires[k]);
            });
            rest = updateRes(rest);
            const canAfford = Object.keys(costs).every(r => {
              rest.resources[r] -= costs[r];
              return rest.resources[r] >= 0;
            });
            if (canBuild && canAfford) {
              rest = events.queueRecruits(rest, data.workers, filteredUnits);
              Town.update({ _id: rest._id, nonce: rest.nonce }, rest)
                .then(r => {
                  if (r.nModified) {
                    return res.json(rest);
                  }
                  return setTimeout(hireWorkers, 10, req, res);
                });
            }
          });
    }
  }
  return res.status(401).end();
}

export function moveWorkers(req, res) {
  const data = req.body;
  const units = data.data;
  if (data.rest && isOwner(req.user, data.rest) && (data.type === 'attack' || data.type === 'support')) {
    return validTarget(data.id, data.target)
    .then(valid => {
      if (!valid) {
        return res.status(404).end();
      }
      return Town.findById(data.rest)
        .then(handleEntityNotFound(res))
          .then(rest => {
            if (!enoughToSend(rest.workers.outside, units)) {
              return res.status(401).end();
            }
            const queuedEvent = events.queueMovement(rest, units, data.type, data.target, data.id);
            rest = queuedEvent.rest;
            rest = updateRes(rest);
            return Town.update({ _id: rest._id, nonce: rest.nonce }, rest)
              .then(r => {
                if (r.nModified) {
                  sendMovementEvent(data.id, queuedEvent.event);
                  return res.json(rest);
                }
                return setTimeout(moveWorkers, 10, req, res);
              });
          });
    });
  }
  return res.status(401).end();
}

function validTarget(id, location) {
  return Town.count({ location, _id: id }).then(c => c);
}

function enoughToSend(allWorkers, sent) {
  const unitTypes = Object.keys(sent);
  if (!unitTypes.length) {
    return false;
  }
  for (const unit of unitTypes) {
    const target = allWorkers.find(w => w.title === unit);
    if (!target || target.count < sent[unit].used - sent[unit].moving) {
      return false;
    }
  }
  return true;
}
