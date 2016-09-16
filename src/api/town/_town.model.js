import mongoose from 'mongoose';
mongoose.Promise = require('bluebird');
import { Schema } from 'mongoose';
import { resAffectedBy } from '../../config/game/workers';
import _ from 'lodash';

export const tempBaseProduction = {
  burgers: 5,
  drinks: 5,
  fries: 5,
  loyals: 1,
  megabucks: 0,
};

const bucksPerFood = 0.5;
const workerProduction = 1;

const RestaurantSchema = new Schema({
  nonce: {
    type: Schema.Types.ObjectId,
    required: true,
    default: mongoose.Types.ObjectId,
  },
  name: String,
  location: [{ type: Number }],
  resources: {
    loyals: {
      type: Number,
      default: 20,
    },
    megabucks: {
      type: Number,
      default: 200,
    },
    burgers: {
      type: Number,
      default: 50,
    },
    fries: {
      type: Number,
      default: 50,
    },
    drinks: {
      type: Number,
      default: 50,
    },
  },
  moneyPercent: {
    type: Number,
    default: 20,
  },
  buildings: [{
    title: String,
    level: Number,
  }],
  workers: {
    kitchen: [{
      title: String,
      count: Number,
    }],
    outside: [{
      title: String,
      count: {
        type: Number,
        default: 0,
      },
      moving: {
        type: Number,
        default: 0,
      },
    }],
  },
  info: String,
  active: {
    type: Boolean,
    default: true,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  events: {
    building: [{
      action: String,
      target: String,
      queued: Date,
      ends: Date,
    }],
    unit: [{
      target: String,
      amount: Number,
      produced: Number,
      queued: Date,
      ends: Date,
    }],
    trade: [{
      amount: Number,
      queued: Date,
      ends: Date,
    }],
    movement: [{
      targetId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurant',
        default: null,
      },
      action: String,
      target: Array,
      units: {},
      queued: Date,
      ends: Date,
    }],
    soonest: Date,
  },
  createdAt: {
    type: Date,
    default: new Date(),
  },
  updatedAt: {
    type: Date,
    default: new Date(),
  },
});

function updateRes(rest) {
  const lastTime = (Date.now() - rest.updatedAt) / (1000 * 60 * 60);
  const resKeys = Object.keys(tempBaseProduction);
  rest.updatedAt = new Date();
  let megabucks = 0;
  resKeys.forEach(r => {
    const wi = _.findKey(rest.workers.kitchen, { title: resAffectedBy[r] });
    const workerCount = wi ? rest.workers.kitchen[wi].count : 0;
    const modifier = r === 'loyals' ? 1 : (100 - rest.moneyPercent) / 100;
    const unmodified = (tempBaseProduction[r] + workerCount * workerProduction) * lastTime;
    const modified = unmodified * modifier;
    if (r !== 'loyals') {
      megabucks += (unmodified - modified) * bucksPerFood;
    }
    rest.resources[r] += modified;
  });
  rest.resources.megabucks += megabucks;
  return rest;
}

RestaurantSchema
  .pre('save', function (next) {
    this.nonce = mongoose.Types.ObjectId();
    if (new Date() - this.updatedAt > 1000) {
      updateRes(this);
    }
    next();
  })
  .pre('update', function (next) {
    this.nonce = mongoose.Types.ObjectId();
    if (new Date() - this.updatedAt > 1000) {
      updateRes(this);
    }
    next();
  })

export const Restaurant = mongoose.model('Restaurant', RestaurantSchema);
export { updateRes };
export default mongoose.model('Restaurant', RestaurantSchema);
