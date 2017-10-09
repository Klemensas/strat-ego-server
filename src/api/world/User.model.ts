import * as crypto from 'crypto';
import { Promise } from 'bluebird';
import { Sequelize, Model, DataTypes, HasMany } from 'sequelize';
import { main } from '../../sqldb';
import { promise } from '../../components/util';

const cryptoPromise: any = Promise.promisifyAll(crypto);
const authTypes = ['github.', 'twitter', 'facebook', 'google'];

export interface Token {
  _id: number;
  role: string;
}

export interface Profile {
  _id: number;
  name: string;
}

export class User extends Model {
  public static associations: {
    Worlds: HasMany;
  };

  public _id: number;
  public name: string;
  public email: string;
  public role: string;
  public password: string;
  public provider: string;
  public salt: string;
  public facebook: any;
  public twitter: any;
  public google: any;
  public github: any;

  // Associations
  public Worlds: World[];

  public get token(): Token {
    return { _id: this._id, role: this.role };
  }

  public get profile(): Profile {
    return { _id: this._id, name: this.name };
  }

  public authenticate(password: string): Promise<boolean> {
    return this.encryptPassword(password)
      .then((encryptedPass) => this.password === encryptedPass);
  }

  public encryptPassword(password: string): Promise<string> {
    if (!password || !this.salt) {
      throw new Error('Missing password');
    }

    const iterations = 10000;
    const keyLength = 64;
    const digest = 'sha256';
    const salt = new Buffer(this.salt, 'base64');
    return promise(crypto.pbkdf2, password, salt, iterations, keyLength, digest)
      .then((encryptedPass) => encryptedPass.toString('base64'));
  }

  public makeSalt(byteSize = 16): Promise<string> {
    return promise(crypto.randomBytes, byteSize)
      .then((salt) => salt.toString('base64'));
  }

  public updatePassword(): Promise<any> {
    if (this.password) {
      if ((!this.password || !this.password.length) && authTypes.indexOf(this.provider) === -1) {
        throw new Error('Invalid password');
      }
    }

    return this.makeSalt()
      .then((salt) => this.salt = salt)
      .then(() => this.encryptPassword(this.password))
      .then((password) => this.password = password);
  }
}

User.init({
  _id: {
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
  email: {
    type: DataTypes.STRING,
    unique: true,
    validate: {
      isEmail: true,
    },
  },
  role: {
    type: DataTypes.STRING,
    defaultValue: 'user',
  },
  password: {
    type: DataTypes.STRING,
    validate: {
      notEmpty: true,
    },
  },
  provider: DataTypes.STRING,
  salt: DataTypes.STRING,
  facebook: DataTypes.JSON,
  twitter: DataTypes.JSON,
  google: DataTypes.JSON,
  github: DataTypes.JSON,
}, { sequelize: main.sequelize });

// Hooks
User.beforeBulkCreate((users: User[], { fields }) => {
  const passwordPromises = users.map((user) => user.updatePassword());
  return Promise.all(passwordPromises);
});
User.beforeCreate((user: User) => {
  return user.updatePassword();
});
User.beforeUpdate((user: User) => {
  if (user.changed('password')) {
    return user.updatePassword();
  }
});

// import { UserWorld } from './UserWorld.model';
import { World } from './World.model';
import { UserWorld } from './UserWorld.model';

export const UserWorldUser = User.belongsToMany(World, { through: UserWorld });

// export const UserWorlds = User.hasMany(UserWorld, { as: 'Worlds', foreignKey: 'UserId' });
