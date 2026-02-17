const Redis = require('ioredis');
const logger = require('./logger');

const redisClient = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    maxRetriesPerRequest: null // Required for Bull
});

redisClient.on('connect', () => {
    logger.info('Redis Client Connected');
});

redisClient.on('error', (err) => {
    logger.error('Redis Client Error', err);
});

module.exports = redisClient;
