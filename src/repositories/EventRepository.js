import { logger } from '../config/logger.js';

/**
 * EventRepository - Data Access Layer for Events
 * Handles persistence and retrieval of event logs
 */
export class EventRepository {
  constructor(redisClient) {
    this.redis = redisClient;
    this.eventPrefix = 'event:';
    this.eventListPrefix = 'events:';
    this.eventTTL = 604800; // 7 days
    this.maxEventsPerType = 1000; // Keep last 1000 events per type
  }

  /**
   * Save an event to Redis
   * @param {string} eventType - Type of event (e.g., 'dispatch:created')
   * @param {Object} data - Event data
   * @param {Object} metadata - Additional metadata (userId, socketId, etc)
   * @returns {Promise<Object>} Saved event data with timestamp
   */
  async saveEvent(eventType, data, metadata = {}) {
    try {
      const eventData = {
        type: eventType,
        data,
        metadata,
        timestamp: new Date().toISOString(),
        id: `${eventType}:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`
      };

      // Save to sorted set (for ordering by timestamp)
      const eventKey = `${this.eventPrefix}${eventType}:${eventData.id}`;
      await this.redis.setEx(
        eventKey,
        this.eventTTL,
        JSON.stringify(eventData)
      );

      // Add to event list (for quick retrieval)
      const listKey = `${this.eventListPrefix}${eventType}`;
      await this.redis.lPush(listKey, JSON.stringify(eventData));

      // Keep only last N events
      await this.redis.lTrim(listKey, 0, this.maxEventsPerType - 1);

      // Set TTL on list
      await this.redis.expire(listKey, this.eventTTL);

      logger.debug(
        { eventType, eventId: eventData.id },
        'Event saved to repository'
      );

      return eventData;
    } catch (error) {
      logger.error({ error, eventType }, 'Failed to save event');
      throw error;
    }
  }

  /**
   * Get event by ID
   * @param {string} eventType - Type of event
   * @param {string} eventId - Event ID
   * @returns {Promise<Object|null>} Event data or null if not found
   */
  async getEvent(eventType, eventId) {
    try {
      const key = `${this.eventPrefix}${eventType}:${eventId}`;
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error({ error, eventType, eventId }, 'Failed to get event');
      return null;
    }
  }

  /**
   * Get events by type (most recent first)
   * @param {string} eventType - Type of event
   * @param {number} limit - Maximum number of events to return
   * @param {number} offset - Offset for pagination
   * @returns {Promise<Array>} Array of events
   */
  async getEventsByType(eventType, limit = 100, offset = 0) {
    try {
      const listKey = `${this.eventListPrefix}${eventType}`;
      const range = await this.redis.lRange(
        listKey,
        offset,
        offset + limit - 1
      );

      const events = range.map(item => JSON.parse(item));
      return events;
    } catch (error) {
      logger.error(
        { error, eventType, limit, offset },
        'Failed to get events by type'
      );
      return [];
    }
  }

  /**
   * Get event count by type
   * @param {string} eventType - Type of event
   * @returns {Promise<number>} Count of events
   */
  async getEventCountByType(eventType) {
    try {
      const listKey = `${this.eventListPrefix}${eventType}`;
      const count = await this.redis.lLen(listKey);
      return count || 0;
    } catch (error) {
      logger.error({ error, eventType }, 'Failed to get event count');
      return 0;
    }
  }

  /**
   * Get events by type and filter
   * @param {string} eventType - Type of event
   * @param {Object} filter - Filter criteria (e.g., { userId: '123' })
   * @param {number} limit - Maximum number of events
   * @returns {Promise<Array>} Filtered events
   */
  async getEventsByTypeAndFilter(eventType, filter = {}, limit = 100) {
    try {
      const listKey = `${this.eventListPrefix}${eventType}`;
      const range = await this.redis.lRange(listKey, 0, limit - 1);

      const events = range
        .map(item => JSON.parse(item))
        .filter(event => {
          // Check if event matches all filter criteria
          return Object.entries(filter).every(([key, value]) => {
            return event.metadata[key] === value || event.data[key] === value;
          });
        });

      return events;
    } catch (error) {
      logger.error(
        { error, eventType, filter },
        'Failed to get filtered events'
      );
      return [];
    }
  }

  /**
   * Get all event types
   * @returns {Promise<Array>} Array of event type names
   */
  async getAllEventTypes() {
    try {
      const pattern = `${this.eventListPrefix}*`;
      let cursor = '0';
      const eventTypes = new Set();

      do {
        const [newCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100
        );
        cursor = newCursor;

        keys.forEach(key => {
          const eventType = key.replace(this.eventListPrefix, '');
          eventTypes.add(eventType);
        });
      } while (cursor !== '0');

      return Array.from(eventTypes);
    } catch (error) {
      logger.error({ error }, 'Failed to get all event types');
      return [];
    }
  }

  /**
   * Get events for a specific user
   * @param {string} userId - User ID
   * @param {number} limit - Maximum number of events
   * @returns {Promise<Array>} User's recent events
   */
  async getEventsByUser(userId, limit = 100) {
    try {
      const pattern = `${this.eventListPrefix}*`;
      let cursor = '0';
      const userEvents = [];

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
          const range = await this.redis.lRange(key, 0, limit - 1);
          const events = range
            .map(item => JSON.parse(item))
            .filter(event => event.metadata?.userId === userId);

          userEvents.push(...events);
        }
      } while (cursor !== '0');

      // Sort by timestamp descending
      return userEvents
        .sort(
          (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
        )
        .slice(0, limit);
    } catch (error) {
      logger.error({ error, userId }, 'Failed to get user events');
      return [];
    }
  }

  /**
   * Delete old events (maintenance)
   * @param {number} daysOld - Delete events older than N days
   * @returns {Promise<number>} Count of deleted events
   */
  async deleteOldEvents(daysOld = 7) {
    try {
      const pattern = `${this.eventPrefix}*`;
      let cursor = '0';
      let deletedCount = 0;
      const thresholdTime = Date.now() - daysOld * 24 * 60 * 60 * 1000;

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
            const event = JSON.parse(data);
            const eventTime = new Date(event.timestamp).getTime();

            if (eventTime < thresholdTime) {
              await this.redis.del(key);
              deletedCount++;
            }
          }
        }
      } while (cursor !== '0');

      if (deletedCount > 0) {
        logger.info({ deletedCount, daysOld }, 'Old events deleted');
      }

      return deletedCount;
    } catch (error) {
      logger.error({ error, daysOld }, 'Failed to delete old events');
      return 0;
    }
  }

  /**
   * Clear all events of a type
   * @param {string} eventType - Type of event to clear
   * @returns {Promise<number>} Count of cleared events
   */
  async clearEventsByType(eventType) {
    try {
      const listKey = `${this.eventListPrefix}${eventType}`;
      const count = await this.redis.lLen(listKey);
      await this.redis.del(listKey);

      logger.info({ eventType, count }, 'Events cleared');
      return count;
    } catch (error) {
      logger.error({ error, eventType }, 'Failed to clear events by type');
      throw error;
    }
  }

  /**
   * Get event statistics
   * @returns {Promise<Object>} Event statistics
   */
  async getEventStatistics() {
    try {
      const eventTypes = await this.getAllEventTypes();
      const stats = {};
      let totalEvents = 0;

      for (const eventType of eventTypes) {
        const count = await this.getEventCountByType(eventType);
        stats[eventType] = count;
        totalEvents += count;
      }

      return {
        totalEvents,
        eventTypes: stats,
        totalEventTypes: eventTypes.length
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get event statistics');
      return {
        totalEvents: 0,
        eventTypes: {},
        totalEventTypes: 0
      };
    }
  }

  /**
   * Archive events (copy to external storage - to be implemented)
   * @param {string} eventType - Type of events to archive
   * @param {number} daysOld - Archive events older than N days
   * @returns {Promise<number>} Count of archived events
   */
  async archiveOldEvents(eventType, daysOld = 30) {
    try {
      const listKey = `${this.eventListPrefix}${eventType}`;
      const thresholdTime = Date.now() - daysOld * 24 * 60 * 60 * 1000;
      const range = await this.redis.lRange(listKey, 0, -1);

      let archivedCount = 0;
      const eventsToKeep = [];

      for (const item of range) {
        const event = JSON.parse(item);
        const eventTime = new Date(event.timestamp).getTime();

        if (eventTime < thresholdTime) {
          // TODO: Send to external storage (S3, database, etc)
          archivedCount++;
        } else {
          eventsToKeep.push(item);
        }
      }

      if (archivedCount > 0) {
        // Update the list with kept events
        await this.redis.del(listKey);
        if (eventsToKeep.length > 0) {
          await this.redis.rPush(listKey, ...eventsToKeep);
          await this.redis.expire(listKey, this.eventTTL);
        }

        logger.info({ eventType, archivedCount }, 'Events archived');
      }

      return archivedCount;
    } catch (error) {
      logger.error({ error, eventType, daysOld }, 'Failed to archive events');
      return 0;
    }
  }
}
