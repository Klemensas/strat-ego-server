import { signToken } from '../../auth/auth.service';
import { getUsers, getUser, deleteUser, createUser } from './userQueries';

function handleError(res, statusCode = 500) {
  return (err) => {
    const error = {
      message: 'Unforseen error',
    };
    if (err && err.constructor) {
      switch (err.constructor.name) {
        case 'UniqueViolationError':
          error.message = `${err.columns.join(', ')} already in use, please pick another one.`;
      }
    }
    res.status(statusCode).send(error);
  };
}

/**
 * Get list of users
 * restriction: 'admin'
 */
export async function index(req, res) {
  try {
    const users = await getUsers();
    return res.status(200).json(users);
  } catch (err) {
    return handleError(res)(err);
  }
}

/**
 * Creates a new user
 */
export async function create(req, res) {
  try {
    const newUser = req.body;
    const user = await createUser(newUser.name, newUser.email, newUser.password);
    return res.json({ token: signToken(user) });
  } catch (err) {

    return handleError(res, 422)(err);
  }
}

/**
 * Get a single user
 */
export async function show(req, res, next) {
  const userId = req.params.id;
  try {
    const user = await getUser({ id: userId });
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
    await deleteUser(req.params.id);
    return res.status(204).end();
  } catch (err) {
    return validationError(res)(err);
  }
}

/**
 * Change a users password
 */
export async function changePassword(req, res) {
  const userId = req.user.id;
  const oldPass = String(req.body.oldPassword);
  const newPass = String(req.body.newPassword);
  try {
    const user = await getUser({ id: userId });
    const isAuthenticated = await user.authenticate(oldPass);
    if (isAuthenticated) {
      await changePassword(user, newPass);
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
