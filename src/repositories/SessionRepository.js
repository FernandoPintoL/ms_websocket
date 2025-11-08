import { logger } from '../config/logger.js';

/**
 * SessionRepository - Data Access Layer for User Sessions
 * Handles persistence and retrieval of user session information
 */
export class SessionRepository {
  constructor(redisClient) {
    this.redis = redisClient;
    this.sessionPrefix = 'session:';
    this.userSessionsPrefix = 'user:sessions:';
    this.sessionTTL = 86400; // 24 hours
  }

  /**
   * Create a new session
   * @param {string} userId - User ID
   * @param {Object} data - Session data
   * @returns {Promise<Object>} Created session with ID and metadata
   */
  async createSession(userId, data = {}) {
    try {
      const sessionId = `${userId}:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;

      const sessionData = {
        sessionId,
        userId,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        ...data
      };

      const key = `${this.sessionPrefix}${sessionId}`;
      await this.redis.setEx(
        key,
        this.sessionTTL,
        JSON.stringify(sessionData)
      );

      // Add to user's sessions set
      await this.redis.sAdd(
        `${this.userSessionsPrefix}${userId}`,
        sessionId
      );

      logger.info({ sessionId, userId }, 'Session created');
      return sessionData;
    } catch (error) {
      logger.error({ error, userId }, 'Failed to create session');
      throw error;
    }
  }

  /**
   * Get session by ID
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object|null>} Session data or null if not found
   */
  async getSession(sessionId) {
    try {
      const key = `${this.sessionPrefix}${sessionId}`;
      const data = await this.redis.get(key);

      if (data) {
        // Update last activity
        const session = JSON.parse(data);
        await this.updateSessionActivity(sessionId);
        return session;
      }

      return null;
    } catch (error) {
      logger.error({ error, sessionId }, 'Failed to get session');
      return null;
    }
  }

  /**
   * Update session data
   * @param {string} sessionId - Session ID
   * @param {Object} data - Data to update
   * @returns {Promise<Object>} Updated session data
   */
  async updateSession(sessionId, data) {
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      const updatedSession = {
        ...session,
        ...data,
        lastUpdate: new Date().toISOString()
      };

      const key = `${this.sessionPrefix}${sessionId}`;
      await this.redis.setEx(
        key,
        this.sessionTTL,
        JSON.stringify(updatedSession)
      );

      logger.info({ sessionId }, 'Session updated');
      return updatedSession;
    } catch (error) {
      logger.error({ error, sessionId }, 'Failed to update session');
      throw error;
    }
  }

  /**
   * Update session last activity timestamp
   * @param {string} sessionId - Session ID
   * @returns {Promise<boolean>} True if updated
   */
  async updateSessionActivity(sessionId) {
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        return false;
      }

      session.lastActivity = new Date().toISOString();
      const key = `${this.sessionPrefix}${sessionId}`;
      await this.redis.setEx(
        key,
        this.sessionTTL,
        JSON.stringify(session)
      );

      return true;
    } catch (error) {
      logger.error({ error, sessionId }, 'Failed to update session activity');
      return false;
    }
  }

  /**
   * Delete a session
   * @param {string} sessionId - Session ID
   * @returns {Promise<boolean>} True if session was deleted
   */
  async deleteSession(sessionId) {
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        return false;
      }

      const key = `${this.sessionPrefix}${sessionId}`;
      await this.redis.del(key);

      // Remove from user's sessions set
      await this.redis.sRem(
        `${this.userSessionsPrefix}${session.userId}`,
        sessionId
      );

      logger.info({ sessionId }, 'Session deleted');
      return true;
    } catch (error) {
      logger.error({ error, sessionId }, 'Failed to delete session');
      throw error;
    }
  }

  /**
   * Check if session exists
   * @param {string} sessionId - Session ID
   * @returns {Promise<boolean>} True if session exists
   */
  async sessionExists(sessionId) {
    try {
      const key = `${this.sessionPrefix}${sessionId}`;
      const exists = await this.redis.exists(key);
      return exists === 1;
    } catch (error) {
      logger.error({ error, sessionId }, 'Failed to check session existence');
      return false;
    }
  }

  /**
   * Get all sessions for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of user's sessions
   */
  async getUserSessions(userId) {
    try {
      const sessionIds = await this.redis.sMembers(
        `${this.userSessionsPrefix}${userId}`
      );

      if (!sessionIds || sessionIds.length === 0) {
        return [];
      }

      const sessions = [];
      for (const sessionId of sessionIds) {
        const session = await this.getSession(sessionId);
        if (session) {
          sessions.push(session);
        } else {
          // Clean up stale entry
          await this.redis.sRem(
            `${this.userSessionsPrefix}${userId}`,
            sessionId
          );
        }
      }

      // Sort by creation date (most recent first)
      return sessions.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
    } catch (error) {
      logger.error({ error, userId }, 'Failed to get user sessions');
      return [];
    }
  }

  /**
   * Get active sessions for a user
   * @param {string} userId - User ID
   * @param {number} inactiveThresholdMinutes - Sessions inactive for X minutes are not active
   * @returns {Promise<Array>} Array of active sessions
   */
  async getActiveUserSessions(userId, inactiveThresholdMinutes = 30) {
    try {
      const sessions = await this.getUserSessions(userId);
      const thresholdTime = Date.now() - inactiveThresholdMinutes * 60 * 1000;

      return sessions.filter(session => {
        const lastActivityTime = new Date(session.lastActivity).getTime();
        return lastActivityTime > thresholdTime;
      });
    } catch (error) {
      logger.error({ error, userId }, 'Failed to get active user sessions');
      return [];
    }
  }

  /**
   * Get user session count
   * @param {string} userId - User ID
   * @returns {Promise<number>} Count of user's sessions
   */
  async getUserSessionCount(userId) {
    try {
      const count = await this.redis.sCard(
        `${this.userSessionsPrefix}${userId}`
      );
      return count || 0;
    } catch (error) {
      logger.error({ error, userId }, 'Failed to get user session count');
      return 0;
    }
  }

  /**
   * Delete all sessions for a user
   * @param {string} userId - User ID
   * @returns {Promise<number>} Count of deleted sessions
   */
  async deleteUserSessions(userId) {
    try {
      const sessions = await this.getUserSessions(userId);
      let deletedCount = 0;

      for (const session of sessions) {
        await this.deleteSession(session.sessionId);
        deletedCount++;
      }

      logger.info({ userId, deletedCount }, 'User sessions deleted');
      return deletedCount;
    } catch (error) {
      logger.error({ error, userId }, 'Failed to delete user sessions');
      throw error;
    }
  }

  /**
   * Delete inactive sessions for a user
   * @param {string} userId - User ID
   * @param {number} inactiveThresholdMinutes - Delete sessions inactive for X minutes
   * @returns {Promise<number>} Count of deleted sessions
   */
  async deleteInactiveSessions(userId, inactiveThresholdMinutes = 60) {
    try {
      const sessions = await this.getUserSessions(userId);
      const thresholdTime = Date.now() - inactiveThresholdMinutes * 60 * 1000;
      let deletedCount = 0;

      for (const session of sessions) {
        const lastActivityTime = new Date(session.lastActivity).getTime();
        if (lastActivityTime < thresholdTime) {
          await this.deleteSession(session.sessionId);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        logger.info(
          { userId, deletedCount, inactiveThresholdMinutes },
          'Inactive sessions deleted'
        );
      }

      return deletedCount;
    } catch (error) {
      logger.error(
        { error, userId, inactiveThresholdMinutes },
        'Failed to delete inactive sessions'
      );
      return 0;
    }
  }

  /**
   * Get all active sessions (system-wide)
   * @returns {Promise<Array>} All active sessions
   */
  async getAllActiveSessions(inactiveThresholdMinutes = 30) {
    try {
      const pattern = `${this.sessionPrefix}*`;
      let cursor = '0';
      const activeSessions = [];
      const thresholdTime = Date.now() - inactiveThresholdMinutes * 60 * 1000;

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
            const session = JSON.parse(data);
            const lastActivityTime = new Date(session.lastActivity).getTime();

            if (lastActivityTime > thresholdTime) {
              activeSessions.push(session);
            }
          }
        }
      } while (cursor !== '0');

      return activeSessions;
    } catch (error) {
      logger.error({ error }, 'Failed to get all active sessions');
      return [];
    }
  }

  /**
   * Get session count (system-wide)
   * @returns {Promise<number>} Total session count
   */
  async getSessionCount() {
    try {
      const pattern = `${this.sessionPrefix}*`;
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
      logger.error({ error }, 'Failed to get session count');
      return 0;
    }
  }

  /**
   * Clean up expired sessions (maintenance)
   * @returns {Promise<number>} Count of cleaned sessions
   */
  async cleanupExpiredSessions() {
    try {
      const pattern = `${this.sessionPrefix}*`;
      let cursor = '0';
      let cleanedCount = 0;

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
          const ttl = await this.redis.ttl(key);
          if (ttl === -2) {
            // Key doesn't exist (already expired)
            cleanedCount++;
          } else if (ttl === -1) {
            // Key exists but has no TTL, delete it
            await this.redis.del(key);
            cleanedCount++;
          }
        }
      } while (cursor !== '0');

      if (cleanedCount > 0) {
        logger.info({ cleanedCount }, 'Expired sessions cleaned');
      }

      return cleanedCount;
    } catch (error) {
      logger.error({ error }, 'Failed to cleanup expired sessions');
      return 0;
    }
  }

  /**
   * Get session statistics
   * @returns {Promise<Object>} Session statistics
   */
  async getSessionStatistics() {
    try {
      const totalSessions = await this.getSessionCount();
      const activeSessions = await this.getAllActiveSessions(30);

      return {
        totalSessions,
        activeSessions: activeSessions.length,
        inactiveSessions: totalSessions - activeSessions.length
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get session statistics');
      return {
        totalSessions: 0,
        activeSessions: 0,
        inactiveSessions: 0
      };
    }
  }
}
