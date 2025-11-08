/**
 * Connection Service
 * Manages WebSocket connections and user sessions
 */

import { logger } from '../config/logger.js';

export class ConnectionService {
  constructor(io, redisClient) {
    this.io = io;
    this.redisClient = redisClient;
  }

  /**
   * Record user connection
   */
  async recordConnection(socket) {
    try {
      const connectionData = {
        socketId: socket.id,
        userId: socket.userId,
        userName: socket.userName,
        userRole: socket.userRole,
        connectedAt: new Date().toISOString(),
        clientIp: socket.handshake.address
      };

      await this.redisClient.setEx(
        `connection:${socket.id}`,
        86400, // 24 hours
        JSON.stringify(connectionData)
      );

      await this.redisClient.sAdd(
        `user:${socket.userId}:connections`,
        socket.id
      );

      logger.info(connectionData, 'Connection recorded');
      return connectionData;
    } catch (error) {
      logger.error({ error, socketId: socket.id }, 'Failed to record connection');
      throw error;
    }
  }

  /**
   * Remove user connection
   */
  async removeConnection(socketId) {
    try {
      const connectionData = await this.redisClient.get(`connection:${socketId}`);

      if (connectionData) {
        const { userId } = JSON.parse(connectionData);
        await this.redisClient.sRem(`user:${userId}:connections`, socketId);
      }

      await this.redisClient.del(`connection:${socketId}`);

      logger.info({ socketId }, 'Connection removed');
    } catch (error) {
      logger.error({ error, socketId }, 'Failed to remove connection');
    }
  }

  /**
   * Get user active connections
   */
  async getUserConnections(userId) {
    try {
      const socketIds = await this.redisClient.sMembers(`user:${userId}:connections`);
      return socketIds;
    } catch (error) {
      logger.error({ error, userId }, 'Failed to get user connections');
      return [];
    }
  }

  /**
   * Get connection count
   */
  async getConnectionCount() {
    try {
      const count = this.io.engine.clientsCount;
      return count;
    } catch (error) {
      logger.error({ error }, 'Failed to get connection count');
      return 0;
    }
  }

  /**
   * Notify all user connections
   */
  notifyUserConnections(userId, eventName, data) {
    try {
      this.io.to(`user:${userId}`).emit(eventName, data);
      logger.debug({ userId, eventName }, 'User connections notified');
    } catch (error) {
      logger.error({ error, userId }, 'Failed to notify user connections');
    }
  }
}

export default ConnectionService;
