import { logger } from '../config/logger.js';

/**
 * ConnectionRepository - Data Access Layer for Socket connections
 * Handles persistence and retrieval of connection information
 */
export class ConnectionRepository {
  constructor(redisClient) {
    this.redis = redisClient;
    this.connectionPrefix = 'connection:';
    this.userConnectionsPrefix = 'user:connections:';
    this.connectionTTL = 86400; // 24 hours
  }

  /**
   * Save a new connection to Redis
   * @param {string} socketId - Socket.IO socket ID
   * @param {string} userId - User ID from JWT
   * @param {Object} metadata - Additional metadata (ip, userAgent, etc)
   * @returns {Promise<Object>} Saved connection data
   */
  async saveConnection(socketId, userId, metadata = {}) {
    try {
      const connectionData = {
        socketId,
        userId,
        connectedAt: new Date().toISOString(),
        ...metadata
      };

      const key = `${this.connectionPrefix}${socketId}`;
      await this.redis.setEx(
        key,
        this.connectionTTL,
        JSON.stringify(connectionData)
      );

      // Add to user's connections set
      await this.redis.sAdd(
        `${this.userConnectionsPrefix}${userId}`,
        socketId
      );

      logger.info({ socketId, userId }, 'Connection saved');
      return connectionData;
    } catch (error) {
      logger.error({ error, socketId, userId }, 'Failed to save connection');
      throw error;
    }
  }

  /**
   * Get connection by socket ID
   * @param {string} socketId - Socket.IO socket ID
   * @returns {Promise<Object|null>} Connection data or null if not found
   */
  async getConnection(socketId) {
    try {
      const key = `${this.connectionPrefix}${socketId}`;
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error({ error, socketId }, 'Failed to get connection');
      return null;
    }
  }

  /**
   * Remove a connection from Redis
   * @param {string} socketId - Socket.IO socket ID
   * @returns {Promise<boolean>} True if connection was removed
   */
  async removeConnection(socketId) {
    try {
      const connection = await this.getConnection(socketId);
      if (!connection) return false;

      const key = `${this.connectionPrefix}${socketId}`;
      await this.redis.del(key);

      // Remove from user's connections set
      await this.redis.sRem(
        `${this.userConnectionsPrefix}${connection.userId}`,
        socketId
      );

      logger.info({ socketId }, 'Connection removed');
      return true;
    } catch (error) {
      logger.error({ error, socketId }, 'Failed to remove connection');
      throw error;
    }
  }

  /**
   * Get all connections for a specific user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of connection data
   */
  async getUserConnections(userId) {
    try {
      const socketIds = await this.redis.sMembers(
        `${this.userConnectionsPrefix}${userId}`
      );

      if (!socketIds || socketIds.length === 0) {
        return [];
      }

      const connections = [];
      for (const socketId of socketIds) {
        const connection = await this.getConnection(socketId);
        if (connection) {
          connections.push(connection);
        } else {
          // Clean up stale entry
          await this.redis.sRem(
            `${this.userConnectionsPrefix}${userId}`,
            socketId
          );
        }
      }

      return connections;
    } catch (error) {
      logger.error({ error, userId }, 'Failed to get user connections');
      return [];
    }
  }

  /**
   * Get all active connections count
   * @returns {Promise<number>} Count of all active connections
   */
  async getConnectionCount() {
    try {
      const pattern = `${this.connectionPrefix}*`;
      let cursor = '0';
      let totalCount = 0;

      do {
        const [newCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100
        );
        cursor = newCursor;
        totalCount += keys.length;
      } while (cursor !== '0');

      return totalCount;
    } catch (error) {
      logger.error({ error }, 'Failed to get connection count');
      return 0;
    }
  }

  /**
   * Get connection count for a specific user
   * @param {string} userId - User ID
   * @returns {Promise<number>} Count of user connections
   */
  async getUserConnectionCount(userId) {
    try {
      const count = await this.redis.sCard(
        `${this.userConnectionsPrefix}${userId}`
      );
      return count || 0;
    } catch (error) {
      logger.error({ error, userId }, 'Failed to get user connection count');
      return 0;
    }
  }

  /**
   * Check if a connection exists
   * @param {string} socketId - Socket.IO socket ID
   * @returns {Promise<boolean>} True if connection exists
   */
  async connectionExists(socketId) {
    try {
      const key = `${this.connectionPrefix}${socketId}`;
      const exists = await this.redis.exists(key);
      return exists === 1;
    } catch (error) {
      logger.error({ error, socketId }, 'Failed to check connection existence');
      return false;
    }
  }

  /**
   * Update connection metadata
   * @param {string} socketId - Socket.IO socket ID
   * @param {Object} metadata - Metadata to update
   * @returns {Promise<Object>} Updated connection data
   */
  async updateConnectionMetadata(socketId, metadata) {
    try {
      const connection = await this.getConnection(socketId);
      if (!connection) {
        throw new Error('Connection not found');
      }

      const updatedConnection = {
        ...connection,
        ...metadata,
        lastUpdate: new Date().toISOString()
      };

      const key = `${this.connectionPrefix}${socketId}`;
      await this.redis.setEx(
        key,
        this.connectionTTL,
        JSON.stringify(updatedConnection)
      );

      logger.info({ socketId }, 'Connection metadata updated');
      return updatedConnection;
    } catch (error) {
      logger.error({ error, socketId }, 'Failed to update connection metadata');
      throw error;
    }
  }

  /**
   * Clean up stale connections (for maintenance)
   * @param {number} ttlSeconds - TTL threshold in seconds
   * @returns {Promise<number>} Count of cleaned connections
   */
  async cleanupStaleConnections(ttlSeconds = this.connectionTTL) {
    try {
      const pattern = `${this.connectionPrefix}*`;
      let cursor = '0';
      let cleanedCount = 0;
      const now = Date.now();

      do {
        const [newCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100
        );
        cursor = newCursor;

        for (const key of keys) {
          const data = await this.redis.get(key);
          if (data) {
            const connection = JSON.parse(data);
            const connectedTime = new Date(connection.connectedAt).getTime();
            const age = (now - connectedTime) / 1000;

            if (age > ttlSeconds) {
              await this.redis.del(key);
              cleanedCount++;
            }
          }
        }
      } while (cursor !== '0');

      if (cleanedCount > 0) {
        logger.info({ cleanedCount }, 'Stale connections cleaned up');
      }

      return cleanedCount;
    } catch (error) {
      logger.error({ error }, 'Failed to cleanup stale connections');
      return 0;
    }
  }

  /**
   * Get all connections (paginated)
   * @param {number} limit - Maximum number of connections to return
   * @param {number} offset - Offset for pagination
   * @returns {Promise<Object>} { connections: Array, total: number }
   */
  async getAllConnections(limit = 100, offset = 0) {
    try {
      const pattern = `${this.connectionPrefix}*`;
      let cursor = '0';
      const allConnections = [];

      do {
        const [newCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          limit
        );
        cursor = newCursor;

        for (const key of keys) {
          const data = await this.redis.get(key);
          if (data) {
            allConnections.push(JSON.parse(data));
          }
        }

        if (allConnections.length >= limit + offset) {
          break;
        }
      } while (cursor !== '0');

      const paginatedConnections = allConnections.slice(offset, offset + limit);

      return {
        connections: paginatedConnections,
        total: allConnections.length,
        limit,
        offset
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get all connections');
      return { connections: [], total: 0, limit, offset };
    }
  }
}
