import {
  Sequelize,
  Model,
  DataTypes,
  HasMany,
  BelongsTo,
} from 'sequelize';
import { world } from '../../sqldb';

export type permissionNames =
  'viewInvites' |
  'editInvites' |
  'manageForum' |
  'editProfile' |
  'viewManagement' |
  'manageRoles' |
  'manageAlliance';

export type AlliancePermissions = {
  [name in permissionNames]: boolean;
};

export const ALLIANCE_PERMISSIONS: permissionNames[] = [
  'viewInvites',
  'editInvites',
  'manageForum',
  'editProfile',
  'viewManagement',
  'manageRoles',
  'manageAlliance',
];

export class AllianceRole extends Model {
  static associations: {
    Players: HasMany;
    Alliance: BelongsTo;
  };

  public id: number;
  public name: string;
  public permissions: AlliancePermissions;

  // Associations
  public Players: Player[];
  public AllianceId: number;
  public Alliance: Alliance;
}
AllianceRole.init({
  id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  permissions: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {
      viewInvites: false,
      editInvites: false,
      manageForum: false,
      editProfile: false,
      viewManagement: false,
      manageRoles: false,
      manageAlliance: false,
    },
  },
}, { sequelize: world.sequelize });

import { Player } from '../world/player.model';
import { Alliance } from './alliance.model';
