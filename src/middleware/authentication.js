import jwt from 'jsonwebtoken';
import { logger } from '../config/logger.js';

/**
 * Authentication Middleware
 * Verifies JWT tokens from Socket.IO handshake
 */

export const authenticateSocket = (jwtSecret, authService) => {
  return async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        logger.warn(
          { socketId: socket.id },
          'Connection attempt without token'
        );
        return next(new Error('Authentication: Missing token'));
      }

      // Verify token
      let user;
      try {
        user = await authService.verifyToken(token);
      } catch (error) {
        logger.warn(
          { socketId: socket.id, error: error.message },
          'Token verification failed'
        );
        return next(new Error('Authentication: Invalid token'));
      }

      // Attach user to socket
      socket.userId = user.id;
      socket.user = user;
      socket.userRole = user.role;
      socket.userPermissions = user.permissions || [];
      socket.handshake.auth.token = token; // Keep token for later use

      logger.info(
        { socketId: socket.id, userId: user.id },
        'Socket authenticated'
      );

      next();
    } catch (error) {
      logger.error(
        { error: error.message, socketId: socket.id },
        'Authentication middleware error'
      );
      next(new Error('Authentication: Server error'));
    }
  };
};

/**
 * Authorization Middleware
 * Checks if user has required role/permission for an operation
 */

export const authorizeSocket = (requiredRole, requiredPermissions = []) => {
  return (socket, data, next) => {
    try {
      // Check role
      if (requiredRole && socket.userRole !== requiredRole) {
        if (Array.isArray(requiredRole)) {
          if (!requiredRole.includes(socket.userRole)) {
            logger.warn(
              {
                socketId: socket.id,
                userId: socket.userId,
                requiredRole,
                actualRole: socket.userRole
              },
              'Unauthorized: Invalid role'
            );
            return next(new Error(`Authorization: Required role: ${requiredRole}`));
          }
        } else {
          logger.warn(
            {
              socketId: socket.id,
              userId: socket.userId,
              requiredRole,
              actualRole: socket.userRole
            },
            'Unauthorized: Invalid role'
          );
          return next(new Error(`Authorization: Required role: ${requiredRole}`));
        }
      }

      // Check permissions
      if (requiredPermissions && requiredPermissions.length > 0) {
        const hasAllPermissions = requiredPermissions.every(perm =>
          socket.userPermissions.includes(perm)
        );

        if (!hasAllPermissions) {
          logger.warn(
            {
              socketId: socket.id,
              userId: socket.userId,
              requiredPermissions,
              userPermissions: socket.userPermissions
            },
            'Unauthorized: Missing permissions'
          );
          return next(new Error('Authorization: Missing permissions'));
        }
      }

      next();
    } catch (error) {
      logger.error(
        { error: error.message },
        'Authorization middleware error'
      );
      next(new Error('Authorization: Server error'));
    }
  };
};

/**
 * Token Refresh Middleware
 * Automatically refreshes tokens near expiration
 */

export const refreshTokenMiddleware = (authService) => {
  return async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next();
      }

      const decoded = jwt.decode(token);
      if (!decoded || !decoded.exp) {
        return next();
      }

      // Check if token expires in less than 5 minutes
      const expiresIn = decoded.exp * 1000 - Date.now();
      if (expiresIn < 300000) { // 5 minutes
        logger.info(
          { socketId: socket.id, userId: socket.userId },
          'Token expiring soon, attempting refresh'
        );

        try {
          const newToken = await authService.refreshToken(token);
          socket.handshake.auth.token = newToken;
          socket.emit('token:refreshed', { token: newToken });
        } catch (error) {
          logger.warn(
            { error: error.message, socketId: socket.id },
            'Token refresh failed'
          );
        }
      }

      next();
    } catch (error) {
      logger.error(
        { error: error.message },
        'Token refresh middleware error'
      );
      next();
    }
  };
};

/**
 * Validation Middleware Factory
 * Creates middleware to validate incoming data against a schema
 */

export const validateSchema = (schema) => {
  return (socket, data, next) => {
    try {
      const { error, value } = schema.validate(data);

      if (error) {
        logger.warn(
          { socketId: socket.id, error: error.message },
          'Data validation failed'
        );
        return next(new Error(`Validation: ${error.message}`));
      }

      // Attach validated data to socket context
      socket.validatedData = value;

      next();
    } catch (error) {
      logger.error(
        { error: error.message },
        'Validation middleware error'
      );
      next(new Error('Validation: Server error'));
    }
  };
};

/**
 * Rate Limiting Middleware
 * Tracks requests per user and enforces limits
 */

export const createRateLimitMiddleware = (redis, options = {}) => {
  const {
    windowMs = 60000, // 1 minute
    maxRequests = 100,
    keyPrefix = 'ratelimit:'
  } = options;

  return (socket, data, next) => {
    const key = `${keyPrefix}${socket.userId}`;

    redis.incr(key, async (err, count) => {
      if (err) {
        logger.error(
          { error: err.message },
          'Rate limiting error'
        );
        return next(); // Continue on error
      }

      if (count === 1) {
        redis.expire(key, Math.ceil(windowMs / 1000));
      }

      if (count > maxRequests) {
        logger.warn(
          {
            socketId: socket.id,
            userId: socket.userId,
            count,
            maxRequests
          },
          'Rate limit exceeded'
        );
        return next(new Error('Rate limit exceeded'));
      }

      next();
    });
  };
};

/**
 * Event Logging Middleware
 * Logs all Socket.IO events for debugging/audit
 */

export const eventLoggingMiddleware = (socket, next) => {
  const originalOn = socket.on.bind(socket);
  const originalEmit = socket.emit.bind(socket);

  socket.on = function(event, ...args) {
    const handler = args[args.length - 1];

    if (typeof handler === 'function') {
      const wrappedHandler = (...callArgs) => {
        logger.debug(
          {
            socketId: socket.id,
            userId: socket.userId,
            event,
            dataSize: JSON.stringify(callArgs[0]).length
          },
          'Socket event received'
        );

        return handler(...callArgs);
      };

      args[args.length - 1] = wrappedHandler;
    }

    return originalOn(event, ...args);
  };

  socket.emit = function(event, ...args) {
    logger.debug(
      {
        socketId: socket.id,
        userId: socket.userId,
        event,
        dataSize: args.length > 0 ? JSON.stringify(args[0]).length : 0
      },
      'Socket event emitted'
    );

    return originalEmit(event, ...args);
  };

  next();
};
