import { Router } from 'express';
import * as controller from './worker.controller';
import * as auth from '../../auth/auth.service';

const router = new Router();

router.get('/', auth.isAuthenticated(), controller.index);
router.post('/hireWorker', auth.isAuthenticated(), controller.hireWorkers);
router.post('/moveWorkers', auth.isAuthenticated(), controller.moveWorkers);
// router.post('/:id/buildings/upgrade', auth.isAuthenticated(), controller.upgradeBuilding);

module.exports = router;

