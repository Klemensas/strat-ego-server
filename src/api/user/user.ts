import * as crypto from 'crypto';
import { UserRoles, UserProviders, Token, Profile } from 'strat-ego-common';
import { World } from '../world/world';
import { BaseModel } from '../../sqldb/baseModel';

export class User extends BaseModel {
  readonly id: number;
  name: string;
  email: string;
  password: string;
  salt: string;
  role: UserRoles;
  provider: UserProviders;
  facebook?: any;
  twitter?: any;
  google?: any;
  github?: any;

  // Relations
  worlds?: Array<Partial<World[]>>;

  static tableName = 'User';

  static relationMappings = {
    worlds: {
      relation: BaseModel.ManyToManyRelation,
      modelClass: 'world',
      join: {
        from: 'User.id',
        through: {
          modelClass: 'userWorld',
          from: 'UserWorld.userId',
          to: 'UserWorld.worldName',
        },
        to: 'World.name',
      },
    },
  };

  static jsonSchema = {
    type: 'object',
    required: ['name', 'email', 'password', 'provider'],

    properties: {
      id: { type: 'integer' },
      name: { type: 'string', unique: 'true' },
      email: { type: 'string', unique: 'true' },
      password: { type: 'string' },
      salt: { type: 'string' },
      role: { type: 'string', enum: ['admin', 'member'], default: 'member' },
      provider: { type: 'string', enum: ['local', 'facebook', 'twitter', 'google', 'github'] },
      facebook: { type: 'object' },
      twitter: { type: 'object' },
      google: { type: 'object' },
      github: { type: 'object' },
    },
  };

  get token(): Token {
    return { id: this.id, role: this.role };
  }

  get profile(): Profile {
    return { id: this.id, name: this.name };
  }

  authenticate(password: string) {
    return this.encryptPassword(password)
      .then((encryptedPass) => this.password === encryptedPass);
  }

  encryptPassword(password: string): Promise<string> {
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

  makeSalt(byteSize = 16): Promise<string> {
    return promise(crypto.randomBytes, byteSize)
      .then((salt) => salt.toString('base64'));
  }

  updatePassword(): Promise<any> {
    if (this.password) {
      if ((!this.password || !this.password.length)) {
        throw new Error('Invalid password');
      }
    }

    return this.makeSalt()
      .then((salt) => this.salt = salt)
      .then(() => this.encryptPassword(this.password))
      .then((password) => this.password = password);
  }

  async $beforeInsert(queryContext) {
    super.$beforeInsert(queryContext);
    await this.updatePassword();
  }

  async $beforeUpdate(opt, queryContext) {
    super.$beforeUpdate(opt, queryContext);
    if (opt.old && opt.old.password !== this.password) {
      await this.updatePassword();
    }
  }
}

export const promise = (targetFunc: any, ...args) => {
  return new Promise<any>((resolve, reject): Promise<any> => {
    return targetFunc(...args, (error: any, result: any) => error ? reject(error) : resolve(result));
  });
};
