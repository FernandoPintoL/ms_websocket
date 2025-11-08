/**
 * Dispatch GraphQL Resolvers
 * Handles queries and mutations related to dispatch management
 */
export const dispatchResolvers = (dispatchService, broadcastService) => {
  return {
    Query: {
      dispatch: async (_, { id }, { userId, token }) => {
        if (!userId) throw new Error('Not authenticated');
        return await dispatchService.getDespacho(id, token);
      },

      despachos: async (
        _,
        { estado, limit = 100, offset = 0 },
        { userId, token }
      ) => {
        if (!userId) throw new Error('Not authenticated');
        const filters = {};
        if (estado) filters.estado = estado;
        return await dispatchService.getDespachos(filters, token);
      },

      despachosByAmbulancia: async (
        _,
        { ambulanciaId },
        { userId, token }
      ) => {
        if (!userId) throw new Error('Not authenticated');
        return await dispatchService.getDespachos(
          { ambulanciaId },
          token
        );
      }
    },

    Mutation: {
      createDispatch: async (
        _,
        { paciente, latitud, longitud, notas },
        { userId, token }
      ) => {
        if (!userId) throw new Error('Not authenticated');

        const dispatch = await dispatchService.createDespacho(
          { paciente, latitud, longitud, notas },
          token
        );

        // Publish event
        await broadcastService.publishEvent('dispatch', {
          type: 'created',
          data: dispatch,
          timestamp: new Date()
        });

        return dispatch;
      },

      updateDispatchStatus: async (
        _,
        { despachoId, estado },
        { userId, token }
      ) => {
        if (!userId) throw new Error('Not authenticated');

        const dispatch = await dispatchService.updateDespachoEstado(
          despachoId,
          estado,
          token
        );

        // Broadcast status update
        await broadcastService.broadcastDispatchEvent(
          despachoId,
          'statusChanged',
          {
            despachoId,
            estado,
            updatedAt: new Date(),
            updatedBy: userId
          }
        );

        return dispatch;
      },

      cancelDispatch: async (
        _,
        { despachoId, razon },
        { userId, token }
      ) => {
        if (!userId) throw new Error('Not authenticated');

        // Update status to CANCELADO
        const dispatch = await dispatchService.updateDespachoEstado(
          despachoId,
          'CANCELADO',
          token
        );

        // Broadcast cancellation
        await broadcastService.broadcastDispatchEvent(
          despachoId,
          'canceled',
          {
            despachoId,
            razon,
            canceledBy: userId,
            canceledAt: new Date()
          }
        );

        return dispatch;
      }
    },

    Subscription: {
      dispatchCreated: {
        subscribe: (_, __, { pubsub }) => {
          return pubsub.asyncIterator(['dispatch:created']);
        },
        resolve: (payload) => payload.data
      },

      dispatchUpdated: {
        subscribe: (_, { despachoId }, { pubsub }) => {
          const channel = `dispatch:${despachoId}:updated`;
          return pubsub.asyncIterator([channel]);
        },
        resolve: (payload) => ({
          dispatch: payload.dispatch,
          changeType: payload.changeType,
          previousState: payload.previousState,
          timestamp: payload.timestamp
        })
      },

      dispatchStatusChanged: {
        subscribe: (_, { despachoId }, { pubsub }) => {
          const channel = `dispatch:${despachoId}:statusChanged`;
          return pubsub.asyncIterator([channel]);
        },
        resolve: (payload) => payload.dispatch
      },

      dispatchCanceled: {
        subscribe: (_, { despachoId }, { pubsub }) => {
          const channel = `dispatch:${despachoId}:canceled`;
          return pubsub.asyncIterator([channel]);
        },
        resolve: (payload) => payload.dispatch
      }
    }
  };
};
