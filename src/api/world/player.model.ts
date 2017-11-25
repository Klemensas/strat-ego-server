import { Sequelize, Model, DataTypes, HasMany, HasManyCreateAssociationMixin } from 'sequelize';
import { Resources, Requirements, Combat } from '../util.model';
import { world } from '../../sqldb';

export class Player extends Model {
  public static associations: {
    Towns: HasMany;
    ReportDestinationPlayer: HasMany,
    ReportOriginPlayer: HasMany,
  };

  static getPlayer = (UserId: number) => Player.findOne({
    where: { UserId },
    include: [{
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
  })

  public id: number;
  public UserId: number;
  public name: string;

  // Associations
  public Towns: Town[];
  public ReportDestinationPlayer: Report[];
  public ReportOriginPlayer: Report[];

  public createTown: HasManyCreateAssociationMixin<Town>;
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

import { Town, townIncludes } from '../town/Town.model';
import { Report } from '../report/Report.model';

export const PlayerOriginReports = Player.hasMany(Report, { as: 'ReportOriginPlayer', foreignKey: 'ReportOriginPlayerId' });
export const PlayerDestinationReports = Player.hasMany(Report, { as: 'ReportDestinationPlayer', foreignKey: 'ReportDestinationPlayerId' });
export const ReportDestinationPlayer = Report.belongsTo(Player, { as: 'ReportDestinationPlayer', foreignKey: 'ReportDestinationPlayerId' });
export const ReportOriginPlayer = Report.belongsTo(Player, { as: 'ReportOriginPlayer', foreignKey: 'ReportOriginPlayerId' });
