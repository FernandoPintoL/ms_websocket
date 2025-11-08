import { logger } from '../config/logger.js';

/**
 * Custom Error Classes
 */

export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.timestamp = new Date().toISOString();
  }
}

export class ValidationError extends AppError {
  constructor(message, details = {}) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource', id = '') {
    const message = id ? `${resource} with id ${id} not found` : `${resource} not found`;
    super(message, 404, 'NOT_FOUND');
    this.resource = resource;
    this.id = id;
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409, 'CONFLICT');
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests', retryAfter = 60) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
    this.retryAfter = retryAfter;
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(service = 'Service') {
    super(`${service} is temporarily unavailable`, 503, 'SERVICE_UNAVAILABLE');
    this.service = service;
  }
}

/**
 * Error Handler Middleware for Express
 */

export const expressErrorHandler = (err, req, res, next) => {
  logger.error(
    {
      error: err.message,
      code: err.code,
      statusCode: err.statusCode,
      stack: err.stack,
      path: req.path,
      method: req.method
    },
    'Express error'
  );

  const statusCode = err.statusCode || 500;
  const response = {
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'An unexpected error occurred',
      timestamp: err.timestamp || new Date().toISOString()
    }
  };

  if (err.details) {
    response.error.details = err.details;
  }

  if (process.env.NODE_ENV === 'development') {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

/**
 * Socket.IO Error Handler
 */

export const socketErrorHandler = (socket) => {
  return async (error, next) => {
    logger.error(
      {
        socketId: socket.id,
        userId: socket.userId,
        error: error.message,
        code: error.code,
        stack: error.stack
      },
      'Socket.IO error'
    );

    // Send error back to client
    socket.emit('error', {
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || 'An unexpected error occurred',
      timestamp: new Date().toISOString()
    });

    // Don't disconnect on error, let client decide
    if (error.code === 'AUTHENTICATION_ERROR') {
      socket.disconnect();
    }
  };
};

/**
 * Event Handler Error Wrapper
 * Wraps Socket.IO event handlers with error catching
 */

export const wrapSocketHandler = (handler) => {
  return async (socket, data, callback) => {
    try {
      await handler(socket, data, callback);
    } catch (error) {
      logger.error(
        {
          socketId: socket.id,
          userId: socket.userId,
          error: error.message,
          stack: error.stack
        },
        'Socket handler error'
      );

      const errorResponse = {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message || 'An unexpected error occurred',
        timestamp: new Date().toISOString()
      };

      // Call callback with error or emit error event
      if (typeof callback === 'function') {
        callback(errorResponse);
      } else {
        socket.emit('error', errorResponse);
      }
    }
  };
};

/**
 * Promise-based Error Handler
 * For use with async/await patterns
 */

export const handleAsyncError = (fn) => {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      logger.error(
        {
          error: error.message,
          stack: error.stack
        },
        'Async error'
      );
      throw error;
    }
  };
};

/**
 * Error Recovery Middleware
 * Attempts to recover from specific errors
 */

export const createErrorRecoveryMiddleware = (redisClient) => {
  return async (socket, error, next) => {
    if (error.code === 'ECONNREFUSED') {
      // Redis or external service connection error
      logger.warn(
        { error: error.message },
        'Connection refused, attempting reconnection'
      );

      try {
        // Try to reconnect
        await redisClient.ping();
        logger.info('Reconnection successful');
      } catch (reconnectError) {
        logger.error(
          { error: reconnectError.message },
          'Reconnection failed'
        );
      }
    }

    next(error);
  };
};

/**
 * Circuit Breaker for External Services
 * Prevents cascading failures
 */

export class CircuitBreaker {
  constructor(options = {}) {
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;

    this.options = {
      failureThreshold: options.failureThreshold || 5,
      successThreshold: options.successThreshold || 3,
      timeout: options.timeout || 60000, // 1 minute
      ...options
    };
  }

  async execute(fn, fallback) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.options.timeout) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      } else {
        // Circuit is open, use fallback
        return fallback ? fallback() : null;
      }
    }

    try {
      const result = await fn();

      if (this.state === 'HALF_OPEN') {
        this.successCount++;
        if (this.successCount >= this.options.successThreshold) {
          this.state = 'CLOSED';
          this.failureCount = 0;
          logger.info('Circuit breaker closed');
        }
      } else if (this.state === 'CLOSED') {
        this.failureCount = 0;
      }

      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.failureCount >= this.options.failureThreshold) {
        this.state = 'OPEN';
        logger.warn('Circuit breaker opened');

        if (fallback) {
          return fallback();
        }
      }

      throw error;
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime
    };
  }

  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
  }
}

/**
 * Error Response Formatter
 * Standardizes error responses
 */

export const formatErrorResponse = (error, includeStack = false) => {
  const response = {
    success: false,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || 'An unexpected error occurred',
      timestamp: error.timestamp || new Date().toISOString(),
      statusCode: error.statusCode || 500
    }
  };

  if (error.details) {
    response.error.details = error.details;
  }

  if (includeStack && error.stack) {
    response.error.stack = error.stack.split('\n');
  }

  return response;
};

/**
 * Retry Logic with Exponential Backoff
 */

export async function retryWithBackoff(fn, options = {}) {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2
  } = options;

  let lastError;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < maxAttempts) {
        logger.warn(
          {
            attempt,
            maxAttempts,
            delay,
            error: error.message
          },
          'Retry attempt'
        );

        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * backoffMultiplier, maxDelay);
      }
    }
  }

  throw lastError;
}
