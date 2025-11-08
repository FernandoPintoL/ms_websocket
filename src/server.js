/**
 * MS WebSocket - Main Server
 * Real-time communication service for ambulance dispatch system
 */

import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import pinoHttp from 'pino-http';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

// Load environment variables
dotenv.config();

// Import application modules
import { logger } from './config/logger.js';
import { redisClient } from './config/redis.js';
import { AuthService } from './services/AuthService.js';
import { DispatchService } from './services/DispatchService.js';
import { ConnectionService } from './services/ConnectionService.js';
import { BroadcastService } from './services/BroadcastService.js';
import { EventService } from './services/EventService.js';
import { HealthCheckService } from './services/HealthCheckService.js';
import { SocketNamespaceController } from './controllers/SocketNamespaceController.js';
import { HealthController } from './controllers/HealthController.js';
import { MetricsController } from './controllers/MetricsController.js';
import { createGraphQLSchema } from './graphql/schema.js';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServer } from '@apollo/server';

/**
 * Initialize Express app
 */
const app = express();
const httpServer = createServer(app);

/**
 * Initialize Socket.IO with Redis adapter
 */
const io = new SocketServer(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
    methods: ['GET', 'POST'],
    credentials: true,
    allowEIO3: true
  },
  transports: ['websocket', 'polling'],
  pingInterval: parseInt(process.env.WS_HEARTBEAT_INTERVAL || '30000'),
  pingTimeout: parseInt(process.env.WS_HEARTBEAT_TIMEOUT || '5000'),
  maxHttpBufferSize: 1e6
});

/**
 * Initialize Services
 */
const authService = new AuthService();
const dispatchService = new DispatchService(io);
const connectionService = new ConnectionService(io, redisClient);
const broadcastService = new BroadcastService(io, redisClient);
const eventService = new EventService(io, redisClient);
const healthCheckService = new HealthCheckService(redisClient);

/**
 * Initialize Controllers
 */
const healthController = new HealthController(healthCheckService);
const metricsController = new MetricsController();

/**
 * Middleware Setup
 */

// Security middleware
app.use(helmet());

// CORS middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Logging middleware
app.use(pinoHttp({ logger }));
app.use(morgan(':method :url :status :response-time ms'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

/**
 * REST API Routes
 */

// Health check endpoint
app.get('/health', (req, res) => {
  healthController.health(req, res);
});

// Detailed health endpoint
app.get('/health/detailed', (req, res) => {
  healthController.detailed(req, res);
});

// Metrics endpoint (Prometheus format)
app.get('/metrics', (req, res) => {
  metricsController.metrics(req, res);
});

// Status endpoint
app.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ms-websocket',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    connections: io.engine.clientsCount
  });
});

/**
 * GraphQL Server Setup
 */

const apolloServer = new ApolloServer({
  schema: createGraphQLSchema(io, redisClient),
  introspection: process.env.NODE_ENV !== 'production',
  plugins: {
    didResolveOperation({ operationName }) {
      logger.info({ operationName }, 'GraphQL operation');
    },
    willSendResponse({ errors }) {
      if (errors) {
        logger.error({ errors }, 'GraphQL errors');
      }
    }
  }
});

// Start Apollo Server
await apolloServer.start();

// GraphQL endpoint
app.use(
  process.env.GRAPHQL_ENDPOINT || '/graphql',
  express.json(),
  expressMiddleware(apolloServer, {
    context: async ({ req }) => {
      const token = req.headers.authorization?.split(' ')[1];
      let user = null;

      if (token) {
        try {
          user = await authService.verifyToken(token);
        } catch (error) {
          logger.warn({ error }, 'Token verification failed');
        }
      }

      return { user, redisClient, io };
    }
  })
);

// GraphQL Playground (development only)
if (process.env.GRAPHQL_PLAYGROUND === 'true' && process.env.NODE_ENV !== 'production') {
  app.get('/playground', (req, res) => {
    res.sendFile(new URL('../public/playground.html', import.meta.url).pathname);
  });
}

/**
 * Socket.IO Middleware
 */

// Authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentication error: Missing token'));
    }

    const user = await authService.verifyToken(token);
    socket.userId = user.id;
    socket.userRole = user.role;
    socket.userName = user.name;

    next();
  } catch (error) {
    logger.error({ error, socketId: socket.id }, 'Socket authentication failed');
    next(new Error(`Authentication error: ${error.message}`));
  }
});

// Rate limiting middleware
io.use((socket, next) => {
  const clientId = socket.handshake.address;
  socket.clientId = clientId;
  next();
});

/**
 * Socket.IO Connection Handlers
 */

io.on('connection', async (socket) => {
  const connectionId = uuidv4();
  socket.connectionId = connectionId;

  logger.info({
    socketId: socket.id,
    userId: socket.userId,
    connectionId
  }, 'User connected');

  try {
    // Record connection in Redis
    await connectionService.recordConnection(socket);

    // Initialize Socket namespace controller
    const socketController = new SocketNamespaceController(
      socket,
      io,
      authService,
      dispatchService,
      broadcastService,
      eventService,
      redisClient
    );

    // Setup socket event listeners
    socketController.setupEventListeners();

  } catch (error) {
    logger.error({ error, socketId: socket.id }, 'Error during socket initialization');
    socket.disconnect(true);
  }

  /**
   * Disconnect handler
   */
  socket.on('disconnect', async (reason) => {
    logger.info({
      socketId: socket.id,
      userId: socket.userId,
      reason
    }, 'User disconnected');

    try {
      await connectionService.removeConnection(socket.id);
      await broadcastService.broadcastUserOffline(socket.userId);
    } catch (error) {
      logger.error({ error, socketId: socket.id }, 'Error during disconnect');
    }
  });

  /**
   * Error handler
   */
  socket.on('error', (error) => {
    logger.error({
      socketId: socket.id,
      userId: socket.userId,
      error
    }, 'Socket error');
  });
});

/**
 * Redis Pub/Sub Setup - Listen for events from other microservices
 */

const redisSub = redisClient.duplicate();
await redisSub.connect();

// Subscribe to dispatch events
redisSub.subscribe('despachos', (message, channel) => {
  try {
    const event = JSON.parse(message);
    logger.info({ event, channel }, 'Redis event received');

    // Broadcast to connected clients
    io.emit('dispatch:event', event);
  } catch (error) {
    logger.error({ error, message }, 'Error processing Redis message');
  }
});

// Subscribe to ambulancia location updates
redisSub.subscribe('ambulancias', (message, channel) => {
  try {
    const event = JSON.parse(message);
    logger.info({ event, channel }, 'Ambulancia event received');

    // Broadcast location updates
    io.to(`dispatch:${event.despacho_id}`).emit('ambulancia:location-updated', event);
  } catch (error) {
    logger.error({ error, message }, 'Error processing ambulancia message');
  }
});

/**
 * Graceful Shutdown Handler
 */

const gracefulShutdown = async (signal) => {
  logger.info({ signal }, 'Graceful shutdown initiated');

  // Close all socket connections gracefully
  io.disconnectSockets();

  // Close HTTP server
  httpServer.close(() => {
    logger.info('HTTP server closed');
  });

  // Close Apollo server
  await apolloServer.stop();

  // Close Redis connections
  await redisClient.quit();
  await redisSub.disconnect();

  logger.info('Graceful shutdown completed');
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

/**
 * Start Server
 */

const PORT = process.env.APP_PORT || 3000;
const HOST = process.env.APP_HOST || '0.0.0.0';

httpServer.listen(PORT, HOST, () => {
  logger.info({
    host: HOST,
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    redis: `${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
    graphql: process.env.GRAPHQL_ENABLED === 'true'
  }, 'Server started successfully');
});

/**
 * Health Check Loop
 */

if (process.env.HEALTH_CHECK_ENABLED === 'true') {
  setInterval(async () => {
    try {
      await healthCheckService.checkHealth();
    } catch (error) {
      logger.error({ error }, 'Health check failed');
    }
  }, parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'));
}

export { app, httpServer, io };
