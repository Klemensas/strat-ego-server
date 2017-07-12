import * as crypto from 'crypto';

const authTypes = ['github.', 'twitter', 'facebook', 'google'];

export default (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    _id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: {
        msg: 'Specified username is already in use.',
      },
    },
    email: {
      type: DataTypes.STRING,
      unique: {
        msg: 'The specified email address is already in use.',
      },
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
  }, {
    // Virtual Getters
    getterMethods: {
      // Public profile information
      profile: function userProfile() {
        return { name: this.name, role: this.role };
      },

      // Non-sensitive info we'll be putting in the token
      token: function tokenData() {
        return { _id: this._id, role: this.role };
      },
    },

    /**
     * Pre-save hooks
     */
    hooks: {
      beforeBulkCreate: (users, fields, fn) => {
        let totalUpdated = 0;
        users.forEach((user) => {
          user.updatePassword((err) => {
            if (err) {
              return fn(err);
            }
            totalUpdated += 1;
            if (totalUpdated === users.length) {
              return fn();
            }
          });
        });
      },
      beforeCreate: (user, fields, fn) => {
        user.updatePassword(fn);
      },
      beforeUpdate: (user, fields, fn) => {
        if (user.changed('password')) {
          return user.updatePassword(fn);
        }
        fn();
      },
    },

    /**
     * Instance Methods
     */
    instanceMethods: {
      /**
       * Authenticate - check if the passwords are the same
       *
       * @param {String} password
       * @param {Function} callback
       * @return {Boolean}
       * @api public
       */
      authenticate(password, callback) {
        if (!callback) {
          return this.password === this.encryptPassword(password);
        }

        this.encryptPassword(password, (err, pwdGen) => {
          if (err) {
            callback(err);
          }

          if (this.password === pwdGen) {
            callback(null, true);
          } else {
            callback(null, false);
          }
        });
      },

      /**
       * Make salt
       *
       * @param {Number} byteSize Optional salt byte size, default to 16
       * @param {Function} callback
       * @return {String}
       * @api public
       */
      makeSalt(byteSize, callback) {
        const defaultByteSize = 16;

        if (typeof arguments[0] === 'function') {
          callback = arguments[0];
          byteSize = defaultByteSize;
        } else if (typeof arguments[1] === 'function') {
          callback = arguments[1];
        }

        if (!byteSize) {
          byteSize = defaultByteSize;
        }

        if (!callback) {
          return crypto.randomBytes(byteSize).toString('base64');
        }

        return crypto.randomBytes(byteSize, (err, salt) => {
          if (err) {
            callback(err);
          }
          return callback(null, salt.toString('base64'));
        });
      },

      /**
       * Encrypt password
       *
       * @param {String} password
       * @param {Function} callback
       * @return {String}
       * @api public
       */
      encryptPassword(password, callback) {
        if (!password || !this.salt) {
          if (!callback) {
            return null;
          }
          return callback(null);
        }

        const defaultIterations = 10000;
        const defaultKeyLength = 64;
        const defaultDigest = 'sha256';
        const salt = new Buffer(this.salt, 'base64');

        if (!callback) {
          return crypto.pbkdf2Sync(password, salt, defaultIterations, defaultKeyLength, defaultDigest)
                       .toString('base64');
        }

        return crypto.pbkdf2(password, salt, defaultIterations, defaultKeyLength, defaultDigest,
          (err, key) => {
            if (err) {
              callback(err);
            }
            return callback(null, key.toString('base64'));
          });
      },

      /**
       * Update password field
       *
       * @param {Function} fn
       * @return {String}
       * @api public
       */
      updatePassword(fn) {
        // Handle new/update passwords
        if (this.password) {
          if ((!this.password || !this.password.length) && authTypes.indexOf(this.provider) === -1) {
            fn(new Error('Invalid password'));
          }

          // Make salt with a callback
          this.makeSalt((saltErr, salt) => {
            if (saltErr) {
              fn(saltErr);
            }
            this.salt = salt;
            this.encryptPassword(this.password, (encryptErr, hashedPassword) => {
              if (encryptErr) {
                fn(encryptErr);
              }
              this.password = hashedPassword;
              fn(null);
            });
          });
        } else {
          fn(null);
        }
      },
    },
  });

  return User;
};
