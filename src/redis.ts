import * as Redis from 'ioredis';
import * as config from './config/environment';

const redis = new Redis({
  port: config.redisPort,
});

const redisReady = new Promise((resolve, reject) => {
  redis.once('connect', () => resolve());
  redis.on('error', (err) => reject(err));
});

export { redis, redisReady };
