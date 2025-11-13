/**
 * WebSocket Server
 *
 * Servidor que proporciona:
 * - Conexiones WebSocket para notificaciones en tiempo real
 * - Escucha de eventos de Redis publicados por otros servicios
 * - Health checks y status endpoints
 */

import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { DispatchEventListener } from './events/dispatchEventListener';
import * as logger from './utils/logger';

// ============================================
// Configuración
// ============================================
const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

const PORT = parseInt(process.env.APP_PORT || '4004');
const HOST = process.env.APP_HOST || '0.0.0.0';

// Mapeo de conexiones activas: clientId -> WebSocket
const activeConnections = new Map<string, WebSocket>();

// Event listener instance
let eventListener: DispatchEventListener;

// ============================================
// Middleware Express
// ============================================
app.use(express.json());

// Logging de requests
app.use((req: Request, res: Response, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// ============================================
// Rutas HTTP
// ============================================

/**
 * Health Check Básico
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'ms-websocket',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    redis_connected: eventListener ? true : false,
  });
});

/**
 * Health Check Detallado
 */
app.get('/health/detailed', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'ms-websocket',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    websocket: {
      active_connections: activeConnections.size,
      server_status: wss ? 'running' : 'not running',
    },
    redis: {
      connected: eventListener ? true : false,
      listening_channels: 1, // despacho:events
    },
    environment: {
      node_env: process.env.NODE_ENV || 'development',
      redis_host: process.env.REDIS_HOST || 'localhost',
      redis_port: process.env.REDIS_PORT || '6379',
    },
  });
});

/**
 * Status Endpoint
 */
app.get('/status', (_req: Request, res: Response) => {
  res.json({
    status: 'operational',
    service: 'ms-websocket',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Estadísticas de Conexiones
 */
app.get('/stats/connections', (_req: Request, res: Response) => {
  const connections = Array.from(activeConnections.entries()).map(([id]) => ({
    id,
    connected_at: new Date().toISOString(),
  }));

  res.json({
    total_connections: activeConnections.size,
    connections: connections,
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// WebSocket Server
// ============================================

wss.on('connection', (ws: WebSocket, req) => {
  // Generar ID único para cada cliente
  const clientId = uuidv4();

  logger.info(`✅ Cliente conectado`, {
    client_id: clientId,
    user_agent: req.headers['user-agent'],
    total_clients: activeConnections.size + 1,
  });

  // Guardar conexión
  activeConnections.set(clientId, ws);

  // Enviar confirmación de conexión al cliente
  ws.send(
    JSON.stringify({
      type: 'connection_established',
      clientId: clientId,
      message: '✅ Conectado al servidor de notificaciones',
      timestamp: new Date().toISOString(),
    })
  );

  // ============================================
  // Event Listeners del WebSocket
  // ============================================

  /**
   * Manejar mensajes del cliente
   */
  ws.on('message', (data: any) => {
    try {
      const message = JSON.parse(data);

      logger.info(`📬 Mensaje recibido de ${clientId}:`, {
        type: message.type,
        client_id: clientId,
      });

      // Aquí puedes manejar comandos del cliente si lo necesitas
      // Por ejemplo: suscribirse a canales específicos
      switch (message.type) {
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
          break;

        case 'get_stats':
          ws.send(
            JSON.stringify({
              type: 'stats',
              data: {
                total_clients: activeConnections.size,
                timestamp: new Date().toISOString(),
              },
            })
          );
          break;

        default:
          logger.warn(`⚠️ Tipo de mensaje desconocido: ${message.type}`);
      }
    } catch (error) {
      logger.error(`❌ Error procesando mensaje de ${clientId}:`, error);
    }
  });

  /**
   * Manejar desconexión del cliente
   */
  ws.on('close', () => {
    activeConnections.delete(clientId);

    logger.info(`❌ Cliente desconectado`, {
      client_id: clientId,
      remaining_clients: activeConnections.size,
    });
  });

  /**
   * Manejar errores del WebSocket
   */
  ws.on('error', (error) => {
    logger.error(`⚠️ Error en WebSocket de ${clientId}:`, error);
  });
});

// ============================================
// Inicialización del Servidor
// ============================================

async function start() {
  try {
    // 1. Iniciar listener de eventos Redis
    logger.info('🔄 Iniciando DispatchEventListener...');
    eventListener = new DispatchEventListener(activeConnections);
    await eventListener.start();

    // 2. Iniciar servidor HTTP
    httpServer.listen(PORT, HOST, () => {
      logger.info(`
╔════════════════════════════════════════╗
║   WebSocket Server Started             ║
╠════════════════════════════════════════╣
║ WS URL:   ws://${HOST}:${PORT}         ║
║ Health:   http://${HOST}:${PORT}/health║
║ Status:   http://${HOST}:${PORT}/status║
║ Stats:    http://${HOST}:${PORT}/stats │
╚════════════════════════════════════════╝
      `);

      logger.info('✅ Servidor listo para recibir conexiones');
      logger.info('📡 Escuchando eventos en Redis canal: despacho:events');
    });
  } catch (error) {
    logger.error('❌ Error iniciando servidor:', error);
    process.exit(1);
  }
}

// ============================================
// Graceful Shutdown
// ============================================

async function shutdown() {
  logger.info('🛑 Iniciando shutdown graceful...');

  // Cerrar todas las conexiones WebSocket
  wss.clients.forEach((client) => {
    client.close(1000, 'Server shutting down');
  });

  // Detener event listener
  if (eventListener) {
    await eventListener.stop();
  }

  // Cerrar servidor HTTP
  httpServer.close(() => {
    logger.info('✅ Servidor cerrado correctamente');
    process.exit(0);
  });

  // Force shutdown después de 10 segundos
  setTimeout(() => {
    logger.error('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// ============================================
// Iniciar
// ============================================

start().catch((error) => {
  logger.error('❌ Fatal error starting server:', error);
  process.exit(1);
});

export { app, httpServer, wss };
