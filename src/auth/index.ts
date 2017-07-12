import * as express from 'express';
// import passport from 'passport';
import config from '../config/environment';
import { main } from '../sqldb';
import localPassport from './local/passport';
import localController from './local';

const User = main.User;

localPassport(User, config);

const router = express.Router();

router.use('/local', localController);
// router.use('/facebook', require('./facebook'));
// router.use('/twitter', require('./twitter'));
// router.use('/google', require('./google'));

module.exports = router;
