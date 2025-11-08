/**
 * Redis Configuration
 * Redis client setup for caching, pub/sub, and sessions
 */

import { createClient } from 'redis';
import { logger } from './logger.js';

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  db: parseInt(process.env.REDIS_DB || '0'),
  password: process.env.REDIS_PASSWORD || undefined,
  retryStrategy: (options) => {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      return new Error('Redis server is unavailable');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      return new Error('Redis connection timeout exceeded');
    }
    if (options.attempt > 10) {
      return undefined;
    }
    return Math.min(options.attempt * 100, 3000);
  }
};

/**
 * Create and configure Redis client
 */
export const redisClient = createClient({
  host: redisConfig.host,
  port: redisConfig.port,
  db: redisConfig.db,
  password: redisConfig.password,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        logger.error('Max Redis reconnection attempts exceeded');
        return new Error('Redis reconnection failed');
      }
      return Math.min(retries * 50, 500);
    }
  }
});

/**
 * Event listeners
 */

redisClient.on('connect', () => {
  logger.info({
    host: redisConfig.host,
    port: redisConfig.port
  }, 'Redis client connected');
});

redisClient.on('error', (error) => {
  logger.error({ error, redis: redisConfig }, 'Redis client error');
});

redisClient.on('reconnecting', () => {
  logger.warn('Redis client reconnecting...');
});

/**
 * Connect to Redis
 */
export async function connectRedis() {
  try {
    await redisClient.connect();
    logger.info('Redis connected successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to connect to Redis');
    throw error;
  }
}

/**
 * Disconnect from Redis
 */
export async function disconnectRedis() {
  try {
    await redisClient.quit();
    logger.info('Redis disconnected successfully');
  } catch (error) {
    logger.error({ error }, 'Error disconnecting Redis');
  }
}

export default redisClient;
