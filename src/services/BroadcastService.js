/**
 * Broadcast Service
 * Handles broadcasting messages to clients and Redis pub/sub
 */

import { logger } from '../config/logger.js';

export class BroadcastService {
  constructor(io, redisClient) {
    this.io = io;
    this.redisClient = redisClient;
  }

  /**
   * Broadcast to all connected clients
   */
  broadcastAll(eventName, data) {
    try {
      this.io.emit(eventName, data);
      logger.debug({ eventName, clientCount: this.io.engine.clientsCount }, 'Broadcast to all');
    } catch (error) {
      logger.error({ error, eventName }, 'Failed to broadcast to all');
    }
  }

  /**
   * Broadcast to specific room
   */
  broadcastRoom(roomName, eventName, data) {
    try {
      this.io.to(roomName).emit(eventName, data);
      logger.debug({ roomName, eventName }, 'Broadcast to room');
    } catch (error) {
      logger.error({ error, roomName, eventName }, 'Failed to broadcast to room');
    }
  }

  /**
   * Broadcast user online status
   */
  async broadcastUserOnline(userId, userData) {
    try {
      const data = {
        userId,
        ...userData,
        status: 'online',
        timestamp: new Date().toISOString()
      };

      this.io.emit('user:online', data);

      await this.redisClient.publish('users', JSON.stringify({
        event: 'user-online',
        ...data
      }));

      logger.info({ userId }, 'User online broadcasted');
    } catch (error) {
      logger.error({ error, userId }, 'Failed to broadcast user online');
    }
  }

  /**
   * Broadcast user offline status
   */
  async broadcastUserOffline(userId) {
    try {
      const data = {
        userId,
        status: 'offline',
        timestamp: new Date().toISOString()
      };

      this.io.emit('user:offline', data);

      await this.redisClient.publish('users', JSON.stringify({
        event: 'user-offline',
        ...data
      }));

      logger.info({ userId }, 'User offline broadcasted');
    } catch (error) {
      logger.error({ error, userId }, 'Failed to broadcast user offline');
    }
  }

  /**
   * Broadcast dispatch event
   */
  async broadcastDispatchEvent(dispatchId, eventName, data) {
    try {
      const eventData = {
        dispatchId,
        eventName,
        ...data,
        timestamp: new Date().toISOString()
      };

      this.io.to(`dispatch:${dispatchId}`).emit(`dispatch:${eventName}`, eventData);

      await this.redisClient.publish('dispatches', JSON.stringify(eventData));

      logger.debug({ dispatchId, eventName }, 'Dispatch event broadcasted');
    } catch (error) {
      logger.error({ error, dispatchId, eventName }, 'Failed to broadcast dispatch event');
    }
  }

  /**
   * Broadcast ambulancia update
   */
  async broadcastAmbulanciaUpdate(ambulanciaId, data) {
    try {
      const updateData = {
        ambulanciaId,
        ...data,
        timestamp: new Date().toISOString()
      };

      this.io.emit(`ambulancia:${ambulanciaId}:updated`, updateData);

      await this.redisClient.publish('ambulancias', JSON.stringify(updateData));

      logger.debug({ ambulanciaId }, 'Ambulancia update broadcasted');
    } catch (error) {
      logger.error({ error, ambulanciaId }, 'Failed to broadcast ambulancia update');
    }
  }

  /**
   * Publish event to Redis
   */
  async publishEvent(channel, event) {
    try {
      await this.redisClient.publish(channel, JSON.stringify({
        ...event,
        timestamp: new Date().toISOString()
      }));

      logger.debug({ channel }, 'Event published to Redis');
    } catch (error) {
      logger.error({ error, channel }, 'Failed to publish event');
    }
  }
}

export default BroadcastService;
