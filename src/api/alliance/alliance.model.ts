import {
  Sequelize,
  Model,
  DataTypes,
  HasMany,
  BelongsToManyAddAssociationsMixin,
  BelongsToManyRemoveAssociationMixin,
  HasOne,
  Transaction,
  WhereOptions,
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

export class Alliance extends Model {
  static associations: {
    Members: HasMany;
    Invitations: HasMany;
    ForumCategories: HasMany;
    AllianceRoles: HasMany;
    DefaultRole: HasOne;
    Forum: HasMany;
    Messages: HasMany[];
  };

  static getAlliance = (where: WhereOptions, transaction?: Transaction) => {
    return Alliance.findOne({
      where,
      transaction,
      include: allianceIncludes,
      order: [
        [{ model: AllianceRole, as: 'Roles' }, 'id', 'ASC'],
      ],
    });
  }

  public id: number;
  public name: string;

  // Associations
  public Roles: AllianceRole[];
  public DefaultRoleId: number;
  public DefaultRole: AllianceRole;
  public Members: Player[];
  public Invitations: Player[];
  public Forum: AllianceForumCategory[];
  public Messages: AllianceMessage[];

  public addInvitation: BelongsToManyAddAssociationsMixin<Player, number>;
  public removeInvitation: BelongsToManyRemoveAssociationMixin<Player, number>;
  public removeMember: BelongsToManyRemoveAssociationMixin<Player, number>;
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
import { AllianceForumTopic } from './allianceForumTopic.model';
import { AllianceForumPost } from './allianceForumPost.model';
import { AllianceMessage } from './allianceMessage.model';

export const allianceIncludes = [{
  model: Player,
  as: 'Members',
  attributes: ['id', 'name'],
  include: [{
    model: AllianceRole,
    as: 'AllianceRole',
  }],
}, {
  model: Player,
  as: 'Invitations',
  attributes: ['id', 'name', 'createdAt'],
}, {
  model: AllianceRole,
  as: 'Roles',
}, {
  model: AllianceRole,
  as: 'DefaultRole',
}, {
  model: AllianceMessage,
  as: 'Messages',
  include: [{
    model: Player,
    as: 'Player',
    attributes: ['name'],
  }],
// }, {
//   model: AllianceForumCategory,
//   as: 'Forum',
//   include: [{
//     model: AllianceForumTopic,
//     as: 'Topic',
//     include: [{
//       model: Player,
//       as: 'Creator',
//       attributes: ['name'],
//     }, {
//       model: AllianceForumPost,
//       as: 'Posts',
//       include: [{
//         model: Player,
//         as: 'Poster',
//         attributes: ['name'],
//       }],
//     }],
//   }],
}];
