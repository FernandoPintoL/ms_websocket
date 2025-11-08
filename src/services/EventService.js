/**
 * Event Service
 * Manages event publishing and subscription
 */

import { logger } from '../config/logger.js';

export class EventService {
  constructor(io, redisClient) {
    this.io = io;
    this.redisClient = redisClient;
    this.eventHandlers = new Map();
  }

  /**
   * Register event handler
   */
  registerHandler(eventName, handler) {
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, []);
    }
    this.eventHandlers.get(eventName).push(handler);
    logger.debug({ eventName }, 'Event handler registered');
  }

  /**
   * Emit event
   */
  async emitEvent(eventName, data) {
    try {
      const handlers = this.eventHandlers.get(eventName) || [];

      for (const handler of handlers) {
        try {
          await handler(data);
        } catch (error) {
          logger.error({ error, eventName }, 'Error in event handler');
        }
      }

      logger.debug({ eventName, handlersCount: handlers.length }, 'Event emitted');
    } catch (error) {
      logger.error({ error, eventName }, 'Failed to emit event');
    }
  }

  /**
   * Subscribe to Redis channel
   */
  async subscribeChannel(channel, handler) {
    try {
      const subscriber = this.redisClient.duplicate();
      await subscriber.connect();

      await subscriber.subscribe(channel, (message) => {
        try {
          const data = JSON.parse(message);
          handler(data);
        } catch (error) {
          logger.error({ error, channel }, 'Error processing channel message');
        }
      });

      logger.info({ channel }, 'Subscribed to Redis channel');
    } catch (error) {
      logger.error({ error, channel }, 'Failed to subscribe to channel');
    }
  }

  /**
   * Publish to Redis channel
   */
  async publish(channel, data) {
    try {
      await this.redisClient.publish(
        channel,
        JSON.stringify({
          ...data,
          timestamp: new Date().toISOString()
        })
      );

      logger.debug({ channel }, 'Event published to Redis');
    } catch (error) {
      logger.error({ error, channel }, 'Failed to publish event');
    }
  }

  /**
   * Record event in Redis
   */
  async recordEvent(eventType, data) {
    try {
      const eventData = {
        type: eventType,
        ...data,
        timestamp: new Date().toISOString()
      };

      const key = `event:${eventType}:${Date.now()}`;
      await this.redisClient.setEx(key, 86400, JSON.stringify(eventData)); // 24 hours

      // Add to event log list
      await this.redisClient.lPush(
        `events:${eventType}`,
        JSON.stringify(eventData)
      );

      // Keep only last 1000 events
      await this.redisClient.lTrim(`events:${eventType}`, 0, 999);

      logger.debug({ eventType }, 'Event recorded');
    } catch (error) {
      logger.error({ error, eventType }, 'Failed to record event');
    }
  }

  /**
   * Get event history
   */
  async getEventHistory(eventType, limit = 100) {
    try {
      const events = await this.redisClient.lRange(
        `events:${eventType}`,
        0,
        limit - 1
      );

      return events.map(event => JSON.parse(event));
    } catch (error) {
      logger.error({ error, eventType }, 'Failed to get event history');
      return [];
    }
  }
}

export default EventService;
