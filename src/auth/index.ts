import * as express from 'express';
// import passport from 'passport';
import config from '../config/environment';
import localPassport from './local/passport';
import localController from './local';

localPassport();

const router = express.Router();

router.use('/local', localController);
// router.use('/facebook', require('./facebook'));
// router.use('/twitter', require('./twitter'));
// router.use('/google', require('./google'));

module.exports = router;
