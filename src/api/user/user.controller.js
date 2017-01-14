import { signToken } from '../../auth/auth.service';
import { main } from '../../sqldb';

const User = main.User;
const UserWorlds = main.UserWorlds;

function validationError(res, statusCode = 422) {
  return err => {
    res.status(statusCode).json(err);
  };
}

function handleError(res, statusCode = 500) {
  return err => {
    res.status(statusCode).send(err);
  };
}

/**
 * Get list of users
 * restriction: 'admin'
 */
export function index(req, res) {
  return User.find({}, '-salt -password')
    .then(users => {
      res.status(200).json(users);
    })
    .catch(handleError(res));
}

/**
 * Creates a new user
 */
// export function create(req, res, next) {
export function create(req, res) {
  const newUser = req.body;
  newUser.provider = 'local';
  newUser.role = 'user';
  User.create(newUser)
    .then(user => {
      res.json({ token: signToken(user) });
    })
    .catch(validationError(res));
}

/**
 * Get a single user
 */
export function show(req, res, next) {
  const userId = req.params.id;

  return User.findById(userId).exec()
    .then(user => {
      if (!user) {
        res.status(404).end();
        return;
      }
      res.json(user.profile);
    })
    .catch(err => next(err));
}

/**
 * Deletes a user
 * restriction: 'admin'
 */
export function destroy(req, res) {
  return User.findByIdAndRemove(req.params.id)
    .then(() => {
      res.status(204).end();
    })
    .catch(handleError(res));
}

/**
 * Change a users password
 */
// export function changePassword(req, res, next) {
export function changePassword(req, res) {
  const userId = req.user._id;
  const oldPass = String(req.body.oldPassword);
  const newPass = String(req.body.newPassword);

  return User.findById(userId).exec()
    .then(user => {
      if (user.authenticate(oldPass)) {
        user.password = newPass;
        return user.save()
          .then(() => {
            res.status(204).end();
          })
          .catch(validationError(res));
      } else {
        return res.status(403).end();
      }
    });
}

/**
 * Get my info
 */
export function me(req, res, next) {
  const userId = req.user._id;
  return User.findOne({
    where: { _id: userId },
    include: [{
      model: UserWorlds,
    }],
  })
  // , '-salt -password').populate('gameData.towns').exec()
    // .then(user => user.getWorlds())
    .then(user => { // don't ever give out the password or salt
      if (!user) {
        return res.status(401).end();
      }
      return res.json(user);
    })
    .catch(err => next(err));
}
