import { Requirements, Resources, BuildingLevelData } from 'strat-ego-common';

import { BaseModel } from '../../sqldb/baseModel';

export class Building extends BaseModel {
  readonly id: number;
  name: string;
  levels: {
    max: number;
    min: number;
  };
  requirements?: Requirements[];
  data: BuildingLevelData;

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
      // requirements: {
      //   type: 'array',
      //   items: {
      //     type: 'object',
      //     properties: {
      //       item: { type: 'string' },
      //       level: { type: 'number' },
      //     },
      //   },
      // },
      // data: {
      //   type: 'array',
      //   items: {
      //     type: 'object',
      //     properties: {
      //       buildTime: { type: 'integer' },
      //       costs: {
      //         type: 'object',
      //         properties: {
      //           wood: { type: 'integer' },
      //           clay: { type: 'integer' },
      //           iron: { type: 'integer' },
      //         },
      //       },
      //     },
      //     score: { type: 'integer' },
      //     storage: { type: 'integer' },
      //     population: { type: 'integer' },
      //     recruitment: { type: 'number' },
      //     production: { type: 'integer' },
      //     defense: { type: 'number' },
      //   },
      // },
    },
  };
}
