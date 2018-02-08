import {
  Sequelize,
  Model,
  DataTypes,
  HasMany,
  HasManyCreateAssociationMixin,
  BelongsTo,
  BelongsToSetAssociationMixin,
  BelongsToCreateAssociationMixin,
  BelongsToManyAddAssociationsMixin,
  WhereOptions,
  Transaction,
  BelongsToManyRemoveAssociationMixin,
  HasOne,
} from 'sequelize';
import { Resources, Requirements, Combat } from '../util.model';
import { world } from '../../sqldb';

export class Player extends Model {
  public static associations: {
    Towns: HasMany;
    ReportDestinationPlayer: HasMany,
    ReportOriginPlayer: HasMany,
    Alliance: BelongsTo;
    AllianceRole: HasOne;
    Invitations: HasMany;
  };

  static getPlayer = (where: WhereOptions, transaction?: Transaction) => {
    return Player.findOne({
      where,
      transaction,
      include: [{
        model: Alliance,
        as: 'Alliance',
        include: allianceIncludes,
      }, {
        model: AllianceRole,
        as: 'AllianceRole',
      }, {
        model: Alliance,
        as: 'Invitations',
        attributes: ['id', 'name', 'createdAt'],
        through: {
          attributes: [],
        },
      }, {
        model: Town,
        as: 'Towns',
        include: townIncludes,
      }, {
        model: Report,
        as: 'ReportDestinationPlayer',
        include: [{
          model: Town,
          as: 'ReportOriginTown',
          attributes: ['id', 'name', 'location'],
        }, {
          model: Town,
          as: 'ReportDestinationTown',
          attributes: ['id', 'name', 'location'],
        }],
      }, {
        model: Report,
        as: 'ReportOriginPlayer',
        include: [{
          model: Town,
          as: 'ReportOriginTown',
          attributes: ['id', 'name', 'location'],
        }, {
          model: Town,
          as: 'ReportDestinationTown',
          attributes: ['id', 'name', 'location'],
        }],
      }],
      order: [
        [
          // { model: Alliance, as: 'Alliance' },
          // { model: AllianceRole, as: 'Roles' },
          { model: Alliance, as: 'Alliance' } as any,
          { model: AllianceRole, as: 'Roles' } as any,
          'id',
          'ASC',
        ],
        ['Alliance', { model: AllianceEvent, as: 'Events' }, 'createdAt', 'DESC'],
      ],
    }).then((player) => {
      if (!player) {
        return;
      }
      player.Towns = player.Towns.map((town) => {
        // town.MovementDestinationTown = town.MovementDestinationTown.map((movement) => movement);
        town.MovementDestinationTown = town.MovementDestinationTown.map((movement) => {
          if (movement.type !== 'attack') {
            delete movement.units;
            delete movement.createdAt;
            delete movement.updatedAt;
          }
          return movement;
        });
        return town;
      });
      return player;
    });
  }

  public id: number;
  public UserId: number;
  public name: string;
  public createdAt: string;
  public updatedAt: string;

  // Associations
  public Towns: Town[];
  public ReportDestinationPlayer: Report[];
  public ReportOriginPlayer: Report[];
  public AllianceId: number;
  public Alliance: Alliance;
  public AllianceRoleId: number;
  public AllianceRole: AllianceRole;
  public Invitations: Alliance[];

  public createTown: HasManyCreateAssociationMixin<Town>;
  public createAlliance: BelongsToCreateAssociationMixin<Alliance>;
  public setAlliance: BelongsToSetAssociationMixin<Alliance, number>;
  public addInvitation: BelongsToManyAddAssociationsMixin<Alliance, number>;
  public removeInvitation: BelongsToManyRemoveAssociationMixin<Alliance, number>;
}
Player.init({
  id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  UserId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, { sequelize: world.sequelize });

import { Town, townIncludes } from '../town/town.model';
import { Report } from '../report/report.model';
import { Alliance, allianceIncludes } from '../alliance/alliance.model';
import { AllianceRole } from '../alliance/allianceRole.model';
import { AllianceForumCategory } from '../alliance/allianceForumCategory.model';
import { AllianceForumTopic } from '../alliance/allianceForumTopic.model';
import { AllianceForumPost } from '../alliance/allianceForumPost.model';
import { AllianceMessage } from '../alliance/allianceMessage.model';
import { AllianceDiplomacy } from '../alliance/allianceDiplomacy.model';
import { AllianceEvent } from '../alliance/allianceEvent.model';

Alliance.hasMany(Player, { as: 'Members', foreignKey: 'AllianceId' });
Player.belongsTo(Alliance, { as: 'Alliance', foreignKey: 'AllianceId' });

Player.belongsToMany(Alliance, { through: 'AllianceInvitations', as: 'Invitations', foreignKey: 'PlayerId' });
Alliance.belongsToMany(Player, { through: 'AllianceInvitations', as: 'Invitations', foreignKey: 'AllianceId' });

Alliance.hasMany(AllianceRole, { as: 'Roles', foreignKey: 'AllianceId' });
AllianceRole.belongsTo(Alliance, { as: 'Roles', foreignKey: 'AllianceId' });

Alliance.belongsTo(AllianceRole, { as: 'DefaultRole', foreignKey: 'DefaultRoleId', constraints: false });

AllianceRole.hasMany(Player, { as: 'AllianceRole', foreignKey: 'AllianceRoleId' });
Player.belongsTo(AllianceRole, { as: 'AllianceRole', foreignKey: 'AllianceRoleId' });

Player.hasMany(Report, { as: 'ReportOriginPlayer', foreignKey: 'ReportOriginPlayerId' });
Report.belongsTo(Player, { as: 'ReportOriginPlayer', foreignKey: 'ReportOriginPlayerId' });
Player.hasMany(Report, { as: 'ReportDestinationPlayer', foreignKey: 'ReportDestinationPlayerId' });
Report.belongsTo(Player, { as: 'ReportDestinationPlayer', foreignKey: 'ReportDestinationPlayerId' });

Alliance.hasMany(AllianceForumCategory, { as: 'Forum', foreignKey: 'AllianceId' });
AllianceForumCategory.belongsTo(Alliance, { as: 'Alliance', foreignKey: 'AllianceId' });

AllianceForumCategory.hasMany(AllianceForumTopic, { as: 'Topic', foreignKey: 'CategoryId' });
AllianceForumTopic.belongsTo(AllianceForumCategory, { as: 'Category', foreignKey: 'CategoryId' });

AllianceForumTopic.hasOne(Player, { as: 'Creator', foreignKey: 'CreatorId' });
Player.belongsTo(AllianceForumTopic, { as: 'Creator', foreignKey: 'CreatorId' });

AllianceForumTopic.hasMany(AllianceForumPost, { as: 'Posts', foreignKey: 'TopicId' });
AllianceForumPost.belongsTo(AllianceForumTopic, { as: 'Topic', foreignKey: 'TopicId' });

AllianceForumPost.hasOne(Player, { as: 'Poster', foreignKey: 'PosterId' });
Player.belongsTo(AllianceForumPost, { as: 'Poster', foreignKey: 'PosterId' });

Alliance.hasMany(AllianceMessage, { as: 'Messages', foreignKey: 'AllianceId' });
AllianceMessage.belongsTo(Alliance, { as: 'Alliance', foreignKey: 'AllianceId' });

Player.hasMany(AllianceMessage, { as: 'AllianceMessages', foreignKey: 'PlayerId' });
AllianceMessage.belongsTo(Player, { as: 'Player', foreignKey: 'PlayerId' });

Alliance.hasMany(AllianceDiplomacy, { as: 'DiplomacyOrigin', foreignKey: 'OriginAllianceId' });
AllianceDiplomacy.belongsTo(Alliance, { as: 'OriginAlliance', foreignKey: 'OriginAllianceId' });

Alliance.hasMany(AllianceDiplomacy, { as: 'DiplomacyTarget', foreignKey: 'TargetAllianceId' });
AllianceDiplomacy.belongsTo(Alliance, { as: 'TargetAlliance', foreignKey: 'TargetAllianceId' });

AllianceDiplomacy.belongsTo(Player, { as: 'OriginPlayer', foreignKey: 'OriginPlayerId' });

AllianceDiplomacy.belongsTo(Player, { as: 'TargetPlayer', foreignKey: 'TargetPlayerId' });

Alliance.hasMany(AllianceEvent, { as: 'Events', foreignKey: 'InitiatingAllianceId' });
// Alliance.hasMany(AllianceEvent, { as: 'TargetEvents', foreignKey: 'TargetAllianceId' });
AllianceEvent.belongsTo(Alliance, { as: 'InitiatingAlliance', foreignKey: 'InitiatingAllianceId' });
AllianceEvent.belongsTo(Alliance, { as: 'TargetAlliance', foreignKey: 'TargetAllianceId' });

AllianceEvent.belongsTo(Player, { as: 'InitiatingPlayer', foreignKey: 'InitiatingPlayerId' });
AllianceEvent.belongsTo(Player, { as: 'TargetPlayer', foreignKey: 'TargetPlayerId' });

// Player.belongsTo(AllianceDiplomacy, { as: 'OriginPlayer', foreignKey: 'OriginPlayerId' });
// AllianceDiplomacy.hasOne(Player, { as: 'OriginPlayer', foreignKey: 'OriginPlayerId' });

// Player.belongsTo(AllianceDiplomacy, { as: 'TargetPlayer', foreignKey: 'TargetPlayerId' });
// AllianceDiplomacy.hasOne(Player, { as: 'TargetPlayer', foreignKey: 'TargetPlayerId' });
