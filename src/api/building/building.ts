import { Requirements, Resources } from 'strat-ego-common';

import { BaseModel } from '../../sqldb/baseModel';

export class Building extends BaseModel {
  readonly id: number;
  name: string;
  levels: {
    max: number;
    min: number;
  };
  requirements?: Requirements[];
  data: [{
    buildTime: number;
    costs: Resources;
    storage?: number;
    population?: number;
    recruitment?: number;
    production?: number;
    defense?: number;
  }];

  static tableName = 'Building';

  static jsonSchema = {
    type: 'object',
    required: ['name', 'levels', 'data'],

    properties: {
      name: { type: 'string' },
      levels: {
        type: 'object',
        properties: {
          max: { type: 'number' },
          min: { type: 'number' },
        },
      },
      requirements: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            item: { type: 'string' },
            level: { type: 'number' },
          },
        },
      },
      data: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            buildTime: { type: 'number' },
            costs: {
              type: 'object',
              properties: {
                wood: { type: 'number' },
                clay: { type: 'number' },
                iron: { type: 'number' },
              },
            },
          },
          storage: { type: 'number' },
          population: { type: 'number' },
          recruitment: { type: 'number' },
          production: { type: 'number' },
          defense: { type: 'number' },
        },
      },
    },
  };
}
