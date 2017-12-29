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
} from 'sequelize';
import { Resources, Requirements, Combat } from '../util.model';
import { world } from '../../sqldb';

export class Player extends Model {
  public static associations: {
    Towns: HasMany;
    ReportDestinationPlayer: HasMany,
    ReportOriginPlayer: HasMany,
    Alliance: BelongsTo;
    Invitations: HasMany;
  };

  static getPlayer = (where: WhereOptions, transaction?: Transaction) => {
    return Player.findOne({
      where,
      transaction,
      include: [{
        model: Alliance,
        as: 'Alliance',
        include: [{
          model: Player,
          as: 'Members',
          attributes: ['id', 'name', 'allianceName', 'allianceRole'],
        }, {
          model: Player,
          as: 'Invitations',
          attributes: ['id', 'name', 'createdAt'],
        }],
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
  public allianceName: string;
  public allianceRole: string;
  public createdAt: string;
  public updatedAt: string;

  // Associations
  public Towns: Town[];
  public ReportDestinationPlayer: Report[];
  public ReportOriginPlayer: Report[];
  public AllianceId: number;
  public Alliance: Alliance;
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
  allianceRole: {
    type: DataTypes.STRING,
  },
  allianceName: {
    type: DataTypes.STRING,
  },
}, { sequelize: world.sequelize });

import { Town, townIncludes } from '../town/Town.model';
import { Report } from '../report/Report.model';
import { Alliance } from './Alliance.model';

Player.belongsToMany(Alliance, { through: 'AllianceInvitations', as: 'Invitations', foreignKey: 'PlayerId' });
Alliance.belongsToMany(Player, { through: 'AllianceInvitations', as: 'Invitations', foreignKey: 'AllianceId' });
Alliance.hasMany(Player, { as: 'Members', foreignKey: 'AllianceId' });
Player.belongsTo(Alliance, { as: 'Alliance', foreignKey: 'AllianceId' });
Player.hasMany(Report, { as: 'ReportOriginPlayer', foreignKey: 'ReportOriginPlayerId' });
Player.hasMany(Report, { as: 'ReportDestinationPlayer', foreignKey: 'ReportDestinationPlayerId' });
Report.belongsTo(Player, { as: 'ReportDestinationPlayer', foreignKey: 'ReportDestinationPlayerId' });
Report.belongsTo(Player, { as: 'ReportOriginPlayer', foreignKey: 'ReportOriginPlayerId' });