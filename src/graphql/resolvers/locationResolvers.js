/**
 * Location/Rastreo GraphQL Resolvers
 * Handles queries and mutations related to location tracking
 */
export const locationResolvers = (dispatchService, broadcastService) => {
  return {
    Query: {
      rastreoHistoria: async (
        _,
        { despachoId, limit = 100 },
        { userId, token }
      ) => {
        if (!userId) throw new Error('Not authenticated');
        return await dispatchService.getRastreoHistoria(despachoId, token);
      }
    },

    Mutation: {
      updateLocation: async (
        _,
        { despachoId, latitud, longitud, velocidad },
        { userId, token, pubsub }
      ) => {
        if (!userId) throw new Error('Not authenticated');

        // Validate coordinates
        if (latitud < -90 || latitud > 90) {
          throw new Error('Invalid latitude');
        }
        if (longitud < -180 || longitud > 180) {
          throw new Error('Invalid longitude');
        }

        const rastreo = await dispatchService.addRastreo(
          despachoId,
          { latitud, longitud, velocidad },
          token
        );

        // Broadcast location update via Redis pub/sub
        await broadcastService.broadcastDispatchEvent(
          despachoId,
          'locationUpdated',
          {
            despachoId,
            rastreo,
            updatedAt: new Date(),
            updatedBy: userId
          }
        );

        // Publish to GraphQL subscription
        const channel = `location:${despachoId}:updated`;
        await pubsub.publish(channel, {
          locationUpdated: {
            despachoId,
            rastreo,
            timestamp: new Date()
          }
        });

        return rastreo;
      }
    },

    Subscription: {
      locationUpdated: {
        subscribe: (_, { despachoId }, { pubsub }) => {
          const channel = `location:${despachoId}:updated`;
          return pubsub.asyncIterator([channel]);
        },
        resolve: (payload) => payload.locationUpdated
      },

      ambulanciaLocationUpdated: {
        subscribe: (_, { ambulanciaId }, { pubsub }) => {
          const channel = `ambulancia:${ambulanciaId}:locationUpdated`;
          return pubsub.asyncIterator([channel]);
        },
        resolve: (payload) => payload.ambulanciaLocationUpdated
      }
    }
  };
};
