import { Router } from 'express';
import * as controller from './world.controller';
import * as auth from '../../auth/auth.service';

const router = new Router();

router.get('/', controller.activeWorlds);
router.get('/:world', auth.isAuthenticated(), controller.worldData);
// router.delete('/:id', auth.hasRole('admin'), controller.destroy);
// router.get('/me', auth.isAuthenticated(), controller.me);
// router.put('/:id/password', auth.isAuthenticated(), controller.changePassword);
// router.get('/:id', auth.isAuthenticated(), controller.show);
// router.post('/', controller.create);

module.exports = router;// default router;
