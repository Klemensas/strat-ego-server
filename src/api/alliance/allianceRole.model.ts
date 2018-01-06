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
  'viewManagement' |
  'manageMinorRoles' |
  'manageAllRoles' |
  'editProfile';

export type AlliancePermissions = {
  [name in permissionNames]: boolean;
};

export const ALLIANCE_PERMISSIONS: permissionNames[] = [
  'viewInvites',
  'editInvites',
  'viewManagement',
  'manageMinorRoles',
  'manageAllRoles',
  'editProfile',
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
      viewManagement: false,
      manageMinorRoles: false,
      manageAllRoles: false,
      editProfile: false,
    },
  },
}, { sequelize: world.sequelize });

import { Player } from '../world/player.model';
import { Alliance } from './alliance.model';
