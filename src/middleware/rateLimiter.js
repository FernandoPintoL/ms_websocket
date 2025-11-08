import { logger } from '../config/logger.js';

/**
 * Token Bucket Rate Limiter
 * Uses Redis to track rate limits across multiple instances
 */

export class RateLimiter {
  constructor(redisClient, options = {}) {
    this.redis = redisClient;
    this.options = {
      windowMs: options.windowMs || 60000, // 1 minute
      maxRequests: options.maxRequests || 100,
      keyPrefix: options.keyPrefix || 'ratelimit:',
      skipSuccessfulRequests: options.skipSuccessfulRequests || false,
      skipFailedRequests: options.skipFailedRequests || false,
      ...options
    };
  }

  /**
   * Create Express middleware for rate limiting
   */
  createExpressMiddleware() {
    return async (req, res, next) => {
      const identifier = req.user?.id || req.ip;
      const key = `${this.options.keyPrefix}${identifier}`;

      try {
        const current = await this.redis.incr(key);

        if (current === 1) {
          await this.redis.expire(key, Math.ceil(this.options.windowMs / 1000));
        }

        const remaining = Math.max(0, this.options.maxRequests - current);
        const resetTime = await this.redis.ttl(key);

        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': this.options.maxRequests.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': new Date(Date.now() + resetTime * 1000).toISOString()
        });

        if (current > this.options.maxRequests) {
          logger.warn(
            {
              identifier,
              current,
              limit: this.options.maxRequests
            },
            'Rate limit exceeded'
          );

          return res.status(429).json({
            success: false,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many requests, please try again later',
              retryAfter: resetTime
            }
          });
        }

        next();
      } catch (error) {
        logger.error(
          { error: error.message },
          'Rate limiter error'
        );
        // Continue on error to avoid blocking requests
        next();
      }
    };
  }

  /**
   * Create Socket.IO middleware for rate limiting
   */
  createSocketMiddleware() {
    return async (socket, next) => {
      const identifier = socket.userId;
      const key = `${this.options.keyPrefix}socket:${identifier}`;

      try {
        const current = await this.redis.incr(key);

        if (current === 1) {
          await this.redis.expire(key, Math.ceil(this.options.windowMs / 1000));
        }

        if (current > this.options.maxRequests) {
          logger.warn(
            {
              socketId: socket.id,
              userId: identifier,
              current,
              limit: this.options.maxRequests
            },
            'Socket rate limit exceeded'
          );

          return next(new Error('Rate limit exceeded'));
        }

        // Attach current count to socket for tracking
        socket.rateLimitCounter = current;

        next();
      } catch (error) {
        logger.error(
          { error: error.message },
          'Socket rate limiter error'
        );
        next();
      }
    };
  }

  /**
   * Check rate limit for a specific user
   */
  async checkLimit(identifier) {
    const key = `${this.options.keyPrefix}${identifier}`;

    try {
      const current = await this.redis.get(key);
      const ttl = await this.redis.ttl(key);

      return {
        current: current ? parseInt(current) : 0,
        limit: this.options.maxRequests,
        remaining: Math.max(0, this.options.maxRequests - (current ? parseInt(current) : 0)),
        resetTime: ttl > 0 ? new Date(Date.now() + ttl * 1000) : null,
        isLimited: current && parseInt(current) > this.options.maxRequests
      };
    } catch (error) {
      logger.error(
        { error: error.message, identifier },
        'Failed to check rate limit'
      );
      return null;
    }
  }

  /**
   * Reset rate limit for a user
   */
  async resetLimit(identifier) {
    const key = `${this.options.keyPrefix}${identifier}`;

    try {
      await this.redis.del(key);
      logger.info({ identifier }, 'Rate limit reset');
      return true;
    } catch (error) {
      logger.error(
        { error: error.message, identifier },
        'Failed to reset rate limit'
      );
      return false;
    }
  }

  /**
   * Set custom limit for a user
   */
  async setCustomLimit(identifier, maxRequests, windowMs) {
    const key = `${this.options.keyPrefix}${identifier}`;

    try {
      await this.redis.setEx(
        `${key}:max`,
        Math.ceil(windowMs / 1000),
        maxRequests.toString()
      );
      logger.info(
        { identifier, maxRequests, windowMs },
        'Custom rate limit set'
      );
      return true;
    } catch (error) {
      logger.error(
        { error: error.message, identifier },
        'Failed to set custom limit'
      );
      return false;
    }
  }
}

/**
 * Sliding Window Rate Limiter
 * More accurate rate limiting using sliding time windows
 */

export class SlidingWindowRateLimiter {
  constructor(redisClient, options = {}) {
    this.redis = redisClient;
    this.options = {
      windowMs: options.windowMs || 60000,
      maxRequests: options.maxRequests || 100,
      keyPrefix: options.keyPrefix || 'sliding_ratelimit:',
      ...options
    };
  }

  /**
   * Check and increment request count
   */
  async checkAndIncrement(identifier) {
    const key = `${this.options.keyPrefix}${identifier}`;
    const now = Date.now();
    const windowStart = now - this.options.windowMs;

    try {
      // Remove old entries outside the window
      await this.redis.zRemRangeByScore(key, '-inf', windowStart);

      // Count requests in current window
      const count = await this.redis.zCard(key);

      if (count >= this.options.maxRequests) {
        return {
          allowed: false,
          remaining: 0,
          retryAfter: await this.redis.zScore(key, 0) + this.options.windowMs - now
        };
      }

      // Add current request
      await this.redis.zAdd(key, now, `${now}:${Math.random()}`);
      await this.redis.expire(key, Math.ceil(this.options.windowMs / 1000));

      return {
        allowed: true,
        remaining: this.options.maxRequests - count - 1,
        resetTime: new Date(windowStart + this.options.windowMs)
      };
    } catch (error) {
      logger.error(
        { error: error.message, identifier },
        'Sliding window rate limiter error'
      );
      return { allowed: true }; // Continue on error
    }
  }
}

/**
 * Distributed Rate Limiter for Socket.IO Events
 * Tracks rate limits per socket per event type
 */

export class DistributedSocketRateLimiter {
  constructor(redisClient, options = {}) {
    this.redis = redisClient;
    this.eventLimits = new Map();
    this.options = {
      keyPrefix: options.keyPrefix || 'socket_event_limit:',
      defaultLimit: options.defaultLimit || 100,
      defaultWindow: options.defaultWindow || 60000,
      ...options
    };
  }

  /**
   * Set rate limit for a specific event
   */
  setEventLimit(eventName, maxRequests, windowMs = this.options.defaultWindow) {
    this.eventLimits.set(eventName, {
      maxRequests,
      windowMs
    });

    logger.info(
      { eventName, maxRequests, windowMs },
      'Event rate limit configured'
    );
  }

  /**
   * Create Socket.IO event handler with rate limiting
   */
  createEventHandler(eventName, handler) {
    const limit = this.eventLimits.get(eventName) || {
      maxRequests: this.options.defaultLimit,
      windowMs: this.options.defaultWindow
    };

    return async (socket, data, callback) => {
      const key = `${this.options.keyPrefix}${socket.userId}:${eventName}`;

      try {
        const current = await this.redis.incr(key);

        if (current === 1) {
          await this.redis.expire(key, Math.ceil(limit.windowMs / 1000));
        }

        if (current > limit.maxRequests) {
          logger.warn(
            {
              socketId: socket.id,
              userId: socket.userId,
              eventName,
              current,
              limit: limit.maxRequests
            },
            'Event rate limit exceeded'
          );

          const error = new Error('Rate limit exceeded for this event');
          error.code = 'EVENT_RATE_LIMIT_EXCEEDED';

          if (typeof callback === 'function') {
            callback(error);
          } else {
            socket.emit('error', error);
          }

          return;
        }

        // Call the actual handler
        await handler(socket, data, callback);
      } catch (error) {
        logger.error(
          { error: error.message, eventName },
          'Event handler error'
        );

        if (typeof callback === 'function') {
          callback(error);
        } else {
          socket.emit('error', error);
        }
      }
    };
  }

  /**
   * Get rate limit status for an event
   */
  async getEventRateLimitStatus(userId, eventName) {
    const key = `${this.options.keyPrefix}${userId}:${eventName}`;
    const limit = this.eventLimits.get(eventName) || {
      maxRequests: this.options.defaultLimit,
      windowMs: this.options.defaultWindow
    };

    try {
      const current = await this.redis.get(key);
      const ttl = await this.redis.ttl(key);

      return {
        current: current ? parseInt(current) : 0,
        limit: limit.maxRequests,
        remaining: Math.max(0, limit.maxRequests - (current ? parseInt(current) : 0)),
        resetTime: ttl > 0 ? new Date(Date.now() + ttl * 1000) : null,
        isLimited: current && parseInt(current) > limit.maxRequests
      };
    } catch (error) {
      logger.error(
        { error: error.message, userId, eventName },
        'Failed to get event rate limit status'
      );
      return null;
    }
  }
}

/**
 * Adaptive Rate Limiter
 * Adjusts limits based on server load
 */

export class AdaptiveRateLimiter {
  constructor(redisClient, options = {}) {
    this.redis = redisClient;
    this.baseLimit = options.baseLimit || 100;
    this.minLimit = options.minLimit || 10;
    this.maxLimit = options.maxLimit || 1000;
    this.cpuThreshold = options.cpuThreshold || 80; // %
    this.memoryThreshold = options.memoryThreshold || 85; // %
  }

  /**
   * Get adaptive limit based on current server health
   */
  async getAdaptiveLimit(identifier) {
    const cpuUsage = process.cpuUsage();
    const memUsage = process.memoryUsage();

    // Calculate memory percentage
    const memPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    // Adjust limit based on load
    let limit = this.baseLimit;

    if (memPercent > this.memoryThreshold) {
      limit = Math.ceil(limit * 0.5); // Reduce by 50%
    } else if (memPercent > this.memoryThreshold * 0.8) {
      limit = Math.ceil(limit * 0.75); // Reduce by 25%
    }

    limit = Math.max(this.minLimit, Math.min(limit, this.maxLimit));

    logger.debug(
      {
        identifier,
        memPercent,
        limit,
        baseLimit: this.baseLimit
      },
      'Adaptive limit calculated'
    );

    return limit;
  }

  /**
   * Create adaptive rate limiter middleware
   */
  createMiddleware() {
    return async (socket, next) => {
      try {
        const adaptiveLimit = await this.getAdaptiveLimit(socket.userId);
        socket.adaptiveRateLimit = adaptiveLimit;
        next();
      } catch (error) {
        logger.error(
          { error: error.message },
          'Adaptive rate limiter error'
        );
        next();
      }
    };
  }
}
