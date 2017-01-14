import { Router } from 'express';
import * as controller from './world.controller';
// import * as auth from '../../auth/auth.service';

const router = new Router();

router.get('/', controller.worlds);
// router.get('/:world', auth.isAuthenticated(), controller.worldData);
// router.get('/:world/player', auth.isAuthenticated(), controller.playerData);

module.exports = router;
