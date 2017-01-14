// import town from './api/town';
// import worker from './api/worker';
// import message from './api/message';
import user from './api/user';
import world from './api/world';
import auth from './auth';

export default app => {
// Disable all routes in favor of socket responses
  // app.use('/api/town', town);
  // app.use('/api/worker', worker);
  // app.use('/api/message', message);
  app.use('/api/users', user);
  app.use('/api/world', world);

  app.use('/auth', auth);

  // Return 404 for everything else
  app.route('/*')
    .get((req, res) => res.sendStatus(404));
};

