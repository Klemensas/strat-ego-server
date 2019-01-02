import { Requirements, Resources, AttackType, Combat } from 'strat-ego-common';

import { BaseModel } from '../../sqldb/baseModel';

export class Unit extends BaseModel {
  readonly id: number;
  name: string;
  attackType: AttackType;
  speed: number;
  recruitTime: number;
  haul: number;
  farmSpace: number;
  requirements?: Requirements[];
  costs: Resources;
  combat: Combat;

  static tableName = 'Unit';

  static jsonSchema = {
    type: 'object',
    required: ['name', 'attackType', 'speed', 'recruitTime', 'haul', 'farmSpace', 'costs', 'combat'],

    properties: {
      name: { type: 'string' },
      attackType: { type: 'string' },
      speed: { type: 'number' },
      recruitTime: { type: 'number' },
      haul: { type: 'number' },
      farmSpace: { type: 'number' },
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
      costs: {
        type: 'object',
        properties: {
          wood: { type: 'number' },
          clay: { type: 'number' },
          iron: { type: 'number' },
        },
      },
      combat: {
        type: 'object',
        properties: {
          attack: { type: 'number' },
          defense: {
            type: 'object',
            properties: {
              general: { type: 'number '},
              cavalry: { type: 'number '},
              archer: { type: 'number '},
            },
          },
        },
      },
    },
  };
}
