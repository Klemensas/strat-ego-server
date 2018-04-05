import { signToken } from '../../auth/auth.service';
import { User } from './user';
import { knexDb } from '../../sqldb';

function validationError(res, statusCode = 422) {
  return (err) => {
    res.status(statusCode).json(err);
  };
}

function handleError(res, statusCode = 500) {
  return (err) => {
    res.status(statusCode).send(err);
  };
}

/**
 * Get list of users
 * restriction: 'admin'
 */
export async function index(req, res) {
  try {
    const users = await User.query(knexDb.main).select(['id', 'name', 'email', 'role', 'provider']);
    return res.status(200).json(users);
  } catch (err) {
    return handleError(res)(err);
  }
}

/**
 * Creates a new user
 */
// export function create(req, res, next) {
export async function create(req, res) {
  const newUser = req.body;
  newUser.provider = 'local';
  newUser.role = 'user';
  try {
    const user = await User.query(knexDb.main).insert(newUser);
    return res.json({ token: signToken(user) });
  } catch (err) {
    return validationError(res)(err);
  }
}

/**
 * Get a single user
 */
export async function show(req, res, next) {
  const userId = req.params.id;
  try {
    const user = await User.query(knexDb.main).findById(userId);
    return res.json(user.profile);
  } catch (err) {
    return validationError(res)(err);
  }
}

/**
 * Deletes a user
 * restriction: 'admin'
 */
export async function destroy(req, res) {
  try {
    const user = await User.query(knexDb.main).deleteById(req.params.id);
    return res.status(204).end();
  } catch (err) {
    return validationError(res)(err);
  }
}

/**
 * Change a users password
 */
// export function changePassword(req, res, next) {
export async function changePassword(req, res) {
  const userId = req.user.id;
  const oldPass = String(req.body.oldPassword);
  const newPass = String(req.body.newPassword);
  try {
    const user = await User.query(knexDb.main).findById(userId);
    const isAuthenticated = await user.authenticate(oldPass);
    if (isAuthenticated) {
      await user.$query(knexDb.main).patch({ 'password': newPass });
      res.status(204).end();
    } else {
      return res.status(403).end();
    }
  } catch (err) {
    return validationError(res)(err);
  }
}

/**
 * Get my info
 */
export async function me(req, res, next) {
  return res.json(req.user);
}
