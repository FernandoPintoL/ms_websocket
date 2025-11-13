/**
 * Dispatch Event Listener
 *
 * Escucha eventos de ms-despacho publicados en Redis
 * y hace broadcast a todos los clientes WebSocket conectados
 */

import Redis from 'ioredis';
import { WebSocket } from 'ws';
import * as logger from '../utils/logger';

interface DispatchEvent {
  type: string;
  data: any;
  service: string;
  timestamp: string;
}

export class DispatchEventListener {
  private subscriber: Redis;
  private activeConnections: Map<string, WebSocket>;

  constructor(activeConnections: Map<string, WebSocket>) {
    this.activeConnections = activeConnections;
    this.subscriber = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0'),
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          // Only reconnect when the error contains "READONLY"
          return true;
        }
        return false;
      },
    });
  }

  /**
   * Iniciar escucha de eventos de Despacho
   */
  public async start(): Promise<void> {
    try {
      // Suscribirse al canal de eventos de Despacho
      await this.subscriber.subscribe('despacho:events', (err, count) => {
        if (err) {
          logger.error('❌ Error suscribiéndose a despacho:events:', err);
        } else {
          logger.info(`✅ Escuchando canal 'despacho:events' (total: ${count})`);
        }
      });

      // Manejar mensajes que llegan
      this.subscriber.on('message', (channel, message) => {
        this.onDispatchEvent(channel, message);
      });

      // Manejar errores
      this.subscriber.on('error', (err) => {
        logger.error('❌ Redis subscriber error:', err);
      });

      // Manejar reconexión
      this.subscriber.on('reconnecting', () => {
        logger.warn('⚠️ Redis reconectando...');
      });

      this.subscriber.on('connect', () => {
        logger.info('✅ Redis conectado');
      });
    } catch (error) {
      logger.error('❌ Error iniciando DispatchEventListener:', error);
      throw error;
    }
  }

  /**
   * Manejar evento de despacho recibido de Redis
   */
  private onDispatchEvent(channel: string, message: string): void {
    try {
      const event: DispatchEvent = JSON.parse(message);

      logger.info(`📥 Evento recibido de ${channel}: ${event.type}`, {
        event_type: event.type,
        data: event.data,
        service: event.service,
      });

      // Hacer broadcast a todos los clientes conectados
      this.broadcastToClients(event);
    } catch (error) {
      logger.error('❌ Error procesando evento de dispatch:', error);
    }
  }

  /**
   * Hacer broadcast de evento a todos los clientes WebSocket
   */
  private broadcastToClients(event: DispatchEvent): void {
    let sentCount = 0;
    let failedCount = 0;

    this.activeConnections.forEach((ws, clientId) => {
      try {
        // Verificar que el WebSocket esté abierto
        if (ws.readyState === WebSocket.OPEN) {
          // Enviar evento formateado
          const message = JSON.stringify({
            type: 'dispatch_event',
            event: event,
            receivedAt: new Date().toIso8601String(),
          });

          ws.send(message);
          sentCount++;
        } else {
          // Cliente desconectado, remover
          this.activeConnections.delete(clientId);
          failedCount++;
        }
      } catch (error) {
        logger.error(`❌ Error enviando a cliente ${clientId}:`, error);
        this.activeConnections.delete(clientId);
        failedCount++;
      }
    });

    logger.info(`📤 Notificación enviada`, {
      sent: sentCount,
      failed: failedCount,
      total_clients: this.activeConnections.size,
    });
  }

  /**
   * Limpiar recursos
   */
  public async stop(): Promise<void> {
    try {
      await this.subscriber.quit();
      logger.info('✅ DispatchEventListener detenido');
    } catch (error) {
      logger.error('❌ Error deteniendo DispatchEventListener:', error);
    }
  }
}
