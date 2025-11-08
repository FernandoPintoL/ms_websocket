/**
 * Broadcast GraphQL Resolvers
 * Handles queries and mutations related to message broadcasting
 */
export const broadcastResolvers = (broadcastService, eventService) => {
  return {
    Query: {
      channelHistory: async (
        _,
        { channel, limit = 100 },
        { userId }
      ) => {
        if (!userId) throw new Error('Not authenticated');

        // Get message history from event service
        const events = await eventService.getEventsByTypeAndFilter(
          `broadcast:${channel}`,
          {},
          limit
        );

        return events.map(event => ({
          id: event.id,
          channel,
          message: event.data.message,
          sender: event.data.sender,
          senderName: event.data.senderName || 'Unknown',
          timestamp: event.timestamp
        }));
      }
    },

    Mutation: {
      broadcastMessage: async (
        _,
        { channel, message },
        { userId, user, pubsub }
      ) => {
        if (!userId) throw new Error('Not authenticated');

        const broadcast = {
          id: `${Date.now()}:${Math.random()}`,
          channel,
          message,
          sender: userId,
          senderName: user?.nombre || 'Unknown',
          timestamp: new Date().toISOString()
        };

        // Record event
        await eventService.recordEvent(`broadcast:${channel}`, broadcast);

        // Publish to Redis pub/sub
        await broadcastService.publishEvent(channel, broadcast);

        // Publish to GraphQL subscription
        const subscriptionChannel = `broadcast:${channel}`;
        await pubsub.publish(subscriptionChannel, {
          messageBroadcast: broadcast
        });

        return broadcast;
      },

      sendDirectMessage: async (
        _,
        { userId: recipientId, message },
        { userId: senderId, user, pubsub }
      ) => {
        if (!senderId) throw new Error('Not authenticated');

        const directMessage = {
          id: `${Date.now()}:${Math.random()}`,
          channel: `dm:${senderId}:${recipientId}`,
          message,
          sender: senderId,
          senderName: user?.nombre || 'Unknown',
          timestamp: new Date().toISOString()
        };

        // Record event
        await eventService.recordEvent('directMessage', directMessage);

        // Publish to Redis pub/sub
        await broadcastService.publishEvent(
          `dm:${senderId}:${recipientId}`,
          directMessage
        );

        // Publish to GraphQL subscription
        const channel = `directMessage:${recipientId}:${senderId}`;
        await pubsub.publish(channel, {
          directMessage
        });

        return directMessage;
      }
    },

    Subscription: {
      messageBroadcast: {
        subscribe: (_, { channel }, { pubsub }) => {
          const subscriptionChannel = `broadcast:${channel}`;
          return pubsub.asyncIterator([subscriptionChannel]);
        },
        resolve: (payload) => payload.messageBroadcast
      },

      directMessage: {
        subscribe: (_, { fromUserId }, { userId, pubsub }) => {
          if (!userId) throw new Error('Not authenticated');
          const channel = `directMessage:${userId}:${fromUserId}`;
          return pubsub.asyncIterator([channel]);
        },
        resolve: (payload) => payload.directMessage
      }
    }
  };
};
