/**
 * Express configuration
 */
import express from 'express';
import cors from 'cors';
import favicon from 'serve-favicon'; // dedicaed favicon handler
import morgan from 'morgan'; // http request logger
import compression from 'compression'; // compression middleware, gzip/deflate
import bodyParser from 'body-parser'; // json parsing middleware;
import methodOverride from 'method-override'; // Add PUT, DELETE... HTTP methods
// import cookieParser from 'cookie-parser'; // Will it use cookies?
import errorHandler from 'errorhandler';
import passport from 'passport'; // authentication
import path from 'path';
import config from './environment';

module.exports = function(app) {
  var env = app.get('env');

  app.set('views', config.root + '/server/views');
  app.engine('html', require('ejs').renderFile);
  app.set('view engine', 'html');
  app.use(compression());
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());
  app.use(methodOverride());
  app.use(passport.initialize());

  app.use(cors());

  app.set('appPath', path.join(config.root, 'client'));

  if ('production' === env) {
    app.use(favicon(path.join(config.root, 'client', 'favicon.ico')));
    app.use(express.static(app.get('appPath')));
    app.use(morgan('dev'));
  }

  if ('development' === env) {
    app.use(require('connect-livereload')());
  }

  if ('development' === env || 'test' === env) {
    app.use(express.static(path.join(config.root, '.tmp')));
    app.use(express.static(app.get('appPath')));
    app.use(morgan('dev'));
    app.use(errorHandler()); // Error handler - has to be last
  }
};