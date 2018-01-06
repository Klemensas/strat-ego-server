import {
  Sequelize,
  Model,
  DataTypes,
  HasMany,
  BelongsToManyAddAssociationsMixin,
  BelongsToManyRemoveAssociationMixin,
  HasOne,
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
  [name in permissionNames]?: boolean;
};

export const ALLIANCE_PERMISSIONS: permissionNames[] = [
  'viewInvites',
  'editInvites',
  'viewManagement',
  'manageMinorRoles',
  'manageAllRoles',
  'editProfile',
];

export class Alliance extends Model {
  static associations: {
    Members: HasMany;
    Invitations: HasMany;
    ForumCategories: HasMany;
    AllianceRoles: HasMany;
    DefaultRole: HasOne;
  };

  public id: number;
  public name: string;

  // Associations
  public Roles: AllianceRole[];
  public DefaultRole: AllianceRole;
  public Members: Player[];
  public Invitations: Player[];
  public ForumCategories: AllianceForumCategory[];

  public addInvitation: BelongsToManyAddAssociationsMixin<Player, number>;
  public removeInvitation: BelongsToManyRemoveAssociationMixin<Player, number>;
}
Alliance.init({
  id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
}, { sequelize: world.sequelize });

import { Player } from '../world/player.model';
import { AllianceForumCategory } from './allianceForumCategory.model';
import { AllianceRole } from './allianceRole.model';
