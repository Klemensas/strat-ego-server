import { Router } from 'express';
import * as controller from './message.controller';
import * as auth from '../../auth/auth.service';

const router = new Router();

router.get('/', controller.index);
router.post('/', auth.userIfLoggedIn(), controller.create);
// router.post('/', auth.attachUser(), controller.create);
// router.get('/:id/buildings', auth.isAuthenticated(), controller.getBuildings);
// router.post('/:id/buildings/upgrade', auth.isAuthenticated(), controller.upgradeBuilding);
// router.put('/:id/password', auth.isAuthenticated(), controller.changePassword);
// router.get('/:id', auth.isAuthenticated(), controller.show);
// router.post('/', controller.create);

module.exports = router;
