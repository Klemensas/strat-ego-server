import sse from 'express-server-sent-events';
import { Router } from 'express';
import * as controller from './restaurant.controller';
import * as auth from '../../auth/auth.service';

var router = new Router();

router.get('/', controller.index);
// router.get('/', auth.hasRole('admin'), controller.index);
// router.delete('/:id', auth.hasRole('admin'), controller.destroy);
// router.get('/', auth.isAuthenticated(), controller.restaurantView);
router.get('/map', auth.isAuthenticated(), controller.map);
router.get('/buildings', auth.isAuthenticated(), controller.getBuildings);
router.get('/:id/events', auth.isAuthenticated(), sse, controller.sseEvents);
router.get('/:id/updateQueues', auth.isAuthenticated(), controller.updateQueues);
router.get('/:id/updateIncoming', auth.isAuthenticated(), controller.updateIncoming);
router.post('/:id/buildings/upgrade', auth.isAuthenticated(), controller.upgradeBuilding);
router.post('/:id/moneyProd', auth.isAuthenticated(), controller.setMoneyProd);
// router.put('/:id/password', auth.isAuthenticated(), controller.changePassword);
// router.get('/:id', auth.isAuthenticated(), controller.show);
// router.post('/', controller.create);

module.exports = router;