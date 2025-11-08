/**
 * User GraphQL Resolvers
 * Handles queries and mutations related to user management
 */
export const userResolvers = (authService, connectionService, broadcastService) => {
  return {
    Query: {
      user: async (_, { id }, { userId, token }) => {
        if (!userId) throw new Error('Not authenticated');
        // Get user from auth service
        return await authService.getUser(id, token);
      },

      currentUser: async (_, __, { userId, user }) => {
        if (!userId) throw new Error('Not authenticated');
        return user;
      },

      onlineUsers: async (_, { limit = 50 }, { userId }) => {
        if (!userId) throw new Error('Not authenticated');

        // Get all active connections
        const pattern = 'connection:*';
        let cursor = '0';
        const users = new Map();
        const redis = connectionService.redis;

        do {
          const [newCursor, keys] = await redis.scan(
            cursor,
            'MATCH',
            pattern,
            'COUNT',
            100
          );
          cursor = newCursor;

          for (const key of keys) {
            const data = await redis.get(key);
            if (data) {
              const connection = JSON.parse(data);
              if (!users.has(connection.userId)) {
                users.set(connection.userId, {
                  userId: connection.userId,
                  connectionCount: 0,
                  lastActivity: connection.connectedAt
                });
              }
              const user = users.get(connection.userId);
              user.connectionCount += 1;
              if (new Date(connection.lastActivity) > new Date(user.lastActivity)) {
                user.lastActivity = connection.lastActivity;
              }
            }
          }
        } while (cursor !== '0');

        // Convert to array and sort by last activity
        const onlineUsers = Array.from(users.values())
          .sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity))
          .slice(0, limit);

        return onlineUsers;
      }
    },

    Mutation: {
      updateUserStatus: async (_, { status }, { userId, user, pubsub }) => {
        if (!userId) throw new Error('Not authenticated');

        const updatedUser = {
          ...user,
          status,
          lastUpdate: new Date()
        };

        // Broadcast user status change
        await pubsub.publish(`user:${userId}:statusChanged`, {
          userStatusChanged: {
            userId,
            status,
            timestamp: new Date()
          }
        });

        return updatedUser;
      }
    },

    Subscription: {
      userStatusChanged: {
        subscribe: (_, { userId }, { pubsub }) => {
          const channel = `user:${userId}:statusChanged`;
          return pubsub.asyncIterator([channel]);
        },
        resolve: (payload) => payload.userStatusChanged
      },

      onlineUsersChanged: {
        subscribe: (_, __, { pubsub }) => {
          return pubsub.asyncIterator(['onlineUsers:changed']);
        },
        resolve: (payload) => payload.onlineUsers
      },

      userConnected: {
        subscribe: (_, { userId }, { pubsub }) => {
          const channel = `user:${userId}:connected`;
          return pubsub.asyncIterator([channel]);
        },
        resolve: (payload) => payload.user
      },

      userDisconnected: {
        subscribe: (_, { userId }, { pubsub }) => {
          const channel = `user:${userId}:disconnected`;
          return pubsub.asyncIterator([channel]);
        },
        resolve: (payload) => payload.user
      }
    }
  };
};
