
const chai = require('chai');
const sinon = require('sinon');
const expect = chai.expect;
const Sequelize = require('sequelize');
this.sequelize = new Sequelize('postgres://stratego:supasecretpassword@localhost:5432/demo');

describe('Hooks', () => {
  beforeEach(() => {
    this.User = this.sequelize.define('User', {
      username: {
        type: Sequelize.DataTypes.STRING,
        allowNull: false
      },
      names: {
        type: Sequelize.DataTypes.ARRAY(Sequelize.DataTypes.STRING),
        defaultValue: ['supa', 'Dupa', 'what']
      },
      mood: {
        type: Sequelize.DataTypes.STRING,
      }
    });
    return this.sequelize.sync({ force: true });
  });
  describe('beforeValidate save', () => {
    it('should persist validation changes', () => {
      this.User.create({ username: 'test' })
        .then(() => this.User.findAll({
          where: Sequelize.where(Sequelize.fn('lower', Sequelize.col('names')))
            // names: {
            //   $iLike: '%dupa%'
            // }
          //   Sequelize.fn('lower', Sequelize.col('names')),
          //   // Sequelize.fn('contains', 'dupa')
          // )
          // {
          //   $key: Sequelize.fn('lower', Sequelize.col('names')),
          //   $val: Sequelize.fn('lower', 'dupa')
              // $val: {
              // $contains: [ Sequelize.fn('lower', 'dupa') ]
            // }
            // Sequelize.fn('contains', (Sequelize.fn('lower')))
          // }
        }))
        .then((users) => expect(users.length).to.equal(1))
      // this.User.beforeSave((user) => {
      //   user.username = 'test-beforeUpdate' + new Date().getTime();
      // });
      // this.User.beforeValidate(user => {
      //   user.username = 'test' + new Date().getTime();
      // })

      // this.User.create({ username: 'T', mood: 'neutral' }).then((user) => {
      //   expect(user.mood).to.equal('neutral');
      //   expect(user.username).not.to.equal('T');

      //   user.mood = 'sad';
      //   return user.save();
      // }).then((user) => {
      //   const savedUsername = user.username;
        
      //   return user.reload().then((reloadedUser) => {
      //     expect(savedUsername).to.equal(reloadedUser.username);
      //   });
      // })
    });
  });
    // describe('#3534, hooks modifications', () => {
    //   it('fields modified in hooks are saved', function() {
    //     const self = this;

    //     this.User.afterValidate(user => {
    //       //if username is defined and has more than 5 char
    //       user.username = user.username
    //         ? user.username.length < 5 ? null : user.username
    //         : null;
    //       user.username = user.username || 'Samorost 3';

    //     });

    //     this.User.beforeValidate(user => {
    //       user.mood = 'sad' + Math.random();
    //     });


    //     return this.User.create({username: 'T', mood: 'neutral'}).then(user => {
    //       expect(user.mood).to.equal('sad');
    //       expect(user.username).to.equal('Samorost 3');

    //       //change attributes
    //       user.mood = 'sad';
    //       user.username = 'Samorost Good One';

    //       return user.save();
    //     }).then(uSaved => {
    //       expect(uSaved.mood).to.equal('sad');
    //       expect(uSaved.username).to.equal('Samorost Good One');

    //       //change attributes, expect to be replaced by hooks
    //       uSaved.username = 'One';

    //       return uSaved.save();
    //     }).then(uSaved => {
    //       //attributes were replaced by hooks ?
    //       expect(uSaved.mood).to.equal('sad');
    //       expect(uSaved.username).to.equal('Samorost 3');
    //       return self.User.findById(uSaved.id);
    //     }).then(uFetched => {
    //       expect(uFetched.mood).to.equal('sad');
    //       expect(uFetched.username).to.equal('Samorost 3');

    //       uFetched.mood = null;
    //       uFetched.username = 'New Game is Needed';

    //       return uFetched.save();
    //     }).then(uFetchedSaved => {
    //       expect(uFetchedSaved.mood).to.equal('neutral');
    //       expect(uFetchedSaved.username).to.equal('New Game is Needed');

    //       return self.User.findById(uFetchedSaved.id);
    //     }).then(uFetched => {
    //       expect(uFetched.mood).to.equal('neutral');
    //       expect(uFetched.username).to.equal('New Game is Needed');

    //       //expect to be replaced by hooks
    //       uFetched.username = 'New';
    //       uFetched.mood = 'happy';
    //       return uFetched.save();
    //     }).then(uFetchedSaved => {
    //       expect(uFetchedSaved.mood).to.equal('happy');
    //       expect(uFetchedSaved.username).to.equal('Samorost 3');
    //     });
    //   });
    // });
  });