import _ from 'lodash';
import mongoose from 'mongoose';
import { Restaurant, updateRes } from './restaurant.model';
import buildings from '../../config/game/buildings';
import workers from '../../config/game/workers';
import events from '../../components/events';
import Promise from 'bluebird';

const subscribedRestaurants = {};

function respondWithResult(res, statusCode) {
  statusCode = statusCode || 200;
  return function(entity) {
    if (entity) {
      res.status(statusCode).json(entity);
    }
  };
}

function saveUpdates(updates) {
  return function(entity) {
    var updated = _.merge(entity, updates);
    return updated.save()
      .spread(updated => {
        return updated;
      });
  };
}

function removeEntity(res) {
  return function(entity) {
    if (entity) {
      return entity.remove()
        .then(() => {
          res.status(204).end();
        });
    }
  };
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

function handleError(res, statusCode) {
  statusCode = statusCode || 500;
  return function(err) {
    res.status(statusCode).send(err);
  };
}

// Gets a list of Things
export function index(req, res) {
  Restaurant.find()
    .then(respondWithResult(res))
    .catch(handleError(res));
}

// Gets a single Restaurant from the DB
export function show(req, res) {
  Restaurant.findById(req.params.id)
    .then(handleEntityNotFound(res))
    .then(respondWithResult(res))
    .catch(handleError(res));
}

export function restaurantView(req, res) {
  res.status(200).send();
}

export function map(req, res) {
  Restaurant.find({}, 'location owner').populate('owner', 'name')
  .then(result => {
    res.status(200).json(result);
  })
    .catch(handleError(res));
}

// Creates a new Restaurant in the DB
export function create(req, res) {
  Restaurant.create(req.body)
    .then(respondWithResult(res, 201))
    .catch(handleError(res));
}

// Updates an existing Restaurant in the DB
export function update(req, res) {
  if (req.body._id) {
    delete req.body._id;
  }
  Restaurant.findById(req.params.id)
    .then(handleEntityNotFound(res))
    .then(saveUpdates(req.body))
    .then(respondWithResult(res))
    .catch(handleError(res));
}

// Deletes a Restaurant from the DB
export function destroy(req, res) {
  Restaurant.findById(req.params.id)
    .then(handleEntityNotFound(res))
    .then(removeEntity(res))
    .catch(handleError(res));
}

// Get building costs and stats
export function getBuildings(req, res) {
  const buildingData = {
    buildTimes: buildings.buildTimes,
    costs: buildings.costsNamed,
    points: buildings.points,
    requirements: buildings.requirements,
    details: buildings.details,
    stored: buildings.stored
  };
  return res.json(buildingData);
}

export function updateQueues(req, res) {
  if (isOwner(req.user, req.params.id)) {
    return Restaurant.findById(req.params.id)
      .then(handleEntityNotFound(res))
      .then(events.checkQueueAndUpdate)
      .then(rest => {
        // TODO: events moved to promise, no more checking if soonest is up?
        // if (rest.events.soonest <= Date.now()) {
          rest = updateRes(rest);
          return Restaurant.update({ _id: rest._id, nonce: rest.nonce }, rest)
          .then(r => {
            if (r.nModified) {
              return res.json(rest);
            }
            return setTimeout(updateQueues, 10, req, res);
          });
        // }
        // return res.status(401).end();
      });
  }
  return res.status(401).end();
}

export function updateIncoming(req, res) {
  if (isOwner(req.user, req.params.id)) {
    const id = mongoose.Types.ObjectId(req.params.id);
    const time = Date.now();
    return findEndedEvents(id, time).then(ev => {
        for (const sender of ev) {
          return Restaurant.findById(sender._id)
            .then(events.checkQueueAndUpdate)
            .then(rest => {
              rest = updateRes(rest);
              return Restaurant.update({ _id: rest._id, nonce: rest.nonce }, rest)
                .then(() => res.status(200).end());
            });
        }
    });
  }
  return res.status(401).end();
}

// Post, attempt to upgrade a building
export function upgradeBuilding(req, res) {
  // TODO: get the user, check if he owns the restaurant, check if he has enough resources and meets the reqs
  if (isOwner(req.user, req.params.id) && typeof req.body.building === 'string') {
    const target = req.body.building;
    return Restaurant.findById(req.params.id)
      .then(handleEntityNotFound(res))
      .then(events.checkQueueAndUpdate)
      .then(rest => {
        rest = updateRes(rest);

        const queuedBuildings = events.queuedBuildings(rest.events.building);
        const buildingIndex = rest.buildings.findIndex(b => b.title === target);
        const building = rest.buildings[buildingIndex];
        const targetLevel = building.level + (queuedBuildings[building.title] || 0);
        const costs = buildings.levelCostsNamed(target, targetLevel);
        // loop through resources, subtracting the costs and returning if the player affords it
        const affords = buildings.resources.every(r => {
          rest.resources[r] -= costs[r];
          return rest.resources[r] >= 0;
        });
        if (!affords) {
          // TODO: error, can't afford
          return res.status(401).end();
        }
        rest = events.queueBuilding(rest, building, targetLevel);
        return Restaurant.update({ _id: rest._id, nonce: rest.nonce }, rest)
        .then(r => {
          if (r.nModified) {
            return res.json(rest);
          }
          return setTimeout(updateQueues, 10, req, res);
        });
      })
      .catch(handleError(res));
  }
  // TODO: error, non user restaurant
  res.status(401).end();
}

export function setMoneyProd(req, res) {
  if (isOwner(req.user, req.params.id) && typeof req.body.percent === 'string') {
    const percent = req.body.percent;
    return Restaurant.findById(req.params.id)
      .then(handleEntityNotFound(res))
      .then(rest => {
        if (canSetMoneyProd(rest)) {
          rest = updateRes(rest);
          rest.moneyPercent = percent;
          return Restaurant.update({ _id: rest._id, nonce: rest.nonce }, rest)
          .then(r => {
            if (r.nModified) {
              return res.json(rest);
            }
            return setTimeout(updateQueues, 10, req, res);
          });
        }
      })
      .catch(handleError(res));
  }
  // TODO: error, non user restaurant
  return res.status(401).end();
}

export function sseEvents(req, res) {
  if (isOwner(req.user, req.params.id)) {
    subscribedRestaurants[req.params.id] = res;

    // Cleanup
    res.on('close', () => {
      delete subscribedRestaurants[req.params.id];
    });
    // Send initial data
    sendEvents(req.params.id, res);
  } else {
    return res.status(404).end();
  }
}

function canSetMoneyProd(rest) {
  // TODO: check if player can control money prod
  return true;
}

// Generates a restaurant for new players
export function generateRestaurant(user) {
  return Restaurant.find({}, 'location -_id')
    .then(resList => {
      const location = findSuitable(resList);
      return Restaurant.create({
        location,
        name: `${user.name}'s restaurant`,
        buildings: buildings.defaultBuildings,
        owner: user,
        workers: workers.defaultWorkers,
      });
    });
}

function isOwner(user, restaurantId) {
  return user.gameData.restaurants.some(r => r.equals(restaurantId));
}

function findSuitable(list) {
  const x = Math.floor(Math.random() * 100 + 1);
  const y = Math.floor(Math.random() * 100 + 1);
  const duplicates = _.find(list, el => { return (el.location[0] === x && el.location[1] === y); });
  if (typeof duplicates === 'undefined') {
    return [x, y];
  }
  return findSuitable(list);
}

export function sendMovementEvent(target, event) {
  if (subscribedRestaurants[target]) {
    subscribedRestaurants[target].sse(`data: ${JSON.stringify({ newMovement: event })}\n\n`);
  }
}

export function sendRestaurantUpdate(target, restaurant) {
  if (subscribedRestaurants[target]) {
    subscribedRestaurants[target].sse(`data: ${JSON.stringify({ rest: restaurant })}\n\n`);
  }
}

function findEvents(id) {
  return Restaurant.aggregate([
    { $match: { "$and": [{ "events.movement.targetId" : id },
      { "events.movement.action" : {"$ne": "returning"} }]}},
    { $project: { "location" : 1, "events.movement" : {
      "$filter" : {
        "input" : "$events.movement", 
        "as" : "movement", 
        "cond" : { "$eq" : ["$$movement.targetId", id] }
      }
    }}}
  ]).exec();
}

function findEndedEvents(id, time) {
  return Restaurant.aggregate([
    { $match: { $and: [
      { 'events.movement.targetId': id },
      { 'events.movement.action': { $ne: 'returning' } },
      { 'events.movement.ends': { $lte: new Date(time) } },
    ] } },
    { $project: { 'location': 1, 'events.movement': {
      $filter: {
        'input': '$events.movement',
        'as': 'movement',
        'cond': { '$eq' : ['$$movement.targetId', id] },
      },
    } } },
  ]).exec();
}

function sendEvents(restId, res) {
  const id = mongoose.Types.ObjectId(restId);
  findEvents(id).then(data => {
    const movements = [];
    for (const sender of data) {
      sender.events.movement.forEach(v =>
        movements.push({
          action: v.action,
          ends: v.ends,
          originId: sender._id,
          location: sender.location,
          queued: v.queued,
        })
      );
    }
    res.sse(`data: ${JSON.stringify({ movement: movements })}\n\n`);
  });
}
