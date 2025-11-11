/**
 * Entity Resolvers for Apollo Federation
 * Resolves entity references from other subgraphs
 * Required for federation to work properly with MS WebSocket
 */

import { logger } from '../../config/logger.js';

/**
 * Entity Resolvers Object
 * Maps __typename to resolver functions for Federation
 */
export const entityResolvers = {
  /**
   * Resolve User entity reference
   * Called when another service references a User by ID
   */
  User: {
    __resolveReference: async (obj, { redisClient, io }) => {
      try {
        if (!obj.id) {
          logger.warn({ obj }, 'User reference missing ID');
          return null;
        }

        // Try to get from Redis cache first
        const cached = await redisClient.get(`user:${obj.id}`);
        if (cached) {
          return JSON.parse(cached);
        }

        // If not in cache, return the object as-is
        // In a real scenario, you'd fetch from MS Autentificación
        // For now, we assume the gateway will provide the data
        return {
          id: String(obj.id),
          nombre: obj.nombre || 'Unknown',
          email: obj.email || '',
          role: obj.role || 'guest',
          isOnline: obj.isOnline || false,
          lastSeen: obj.lastSeen || new Date().toISOString(),
          createdAt: obj.createdAt || new Date().toISOString()
        };
      } catch (error) {
        logger.error({ error, userId: obj.id }, 'Error resolving User reference');
        return null;
      }
    }
  },

  /**
   * Resolve Dispatch entity reference
   * Called when another service references a Dispatch by ID
   */
  Dispatch: {
    __resolveReference: async (obj, { redisClient, io }) => {
      try {
        if (!obj.id) {
          logger.warn({ obj }, 'Dispatch reference missing ID');
          return null;
        }

        // Try to get from Redis cache first
        const cached = await redisClient.get(`dispatch:${obj.id}`);
        if (cached) {
          return JSON.parse(cached);
        }

        // Return the object as-is from federation
        return {
          id: String(obj.id),
          numero: obj.numero || '',
          estado: obj.estado || 'PENDIENTE',
          paciente: obj.paciente || null,
          ubicacion: obj.ubicacion || { latitud: 0, longitud: 0 },
          ambulanciaId: obj.ambulanciaId ? String(obj.ambulanciaId) : null,
          ambulanciaPlaca: obj.ambulanciaPlaca || null,
          driverName: obj.driverName || null,
          notas: obj.notas || null,
          fechaCreacion: obj.fechaCreacion || new Date().toISOString(),
          fechaActualizacion: obj.fechaActualizacion || new Date().toISOString(),
          tiempoEstimado: obj.tiempoEstimado || null,
          prioridad: obj.prioridad || null
        };
      } catch (error) {
        logger.error({ error, despachoId: obj.id }, 'Error resolving Dispatch reference');
        return null;
      }
    }
  },

  /**
   * Resolve Ambulancia entity reference
   * Called when another service references an Ambulancia by ID
   */
  Ambulancia: {
    __resolveReference: async (obj, { redisClient, io }) => {
      try {
        if (!obj.id) {
          logger.warn({ obj }, 'Ambulancia reference missing ID');
          return null;
        }

        // Try to get from Redis cache first
        const cached = await redisClient.get(`ambulancia:${obj.id}`);
        if (cached) {
          return JSON.parse(cached);
        }

        // Return the object as-is from federation
        return {
          id: String(obj.id),
          placa: obj.placa || '',
          estado: obj.estado || 'disponible',
          ubicacion: obj.ubicacion || { latitud: 0, longitud: 0 },
          driverName: obj.driverName || null,
          disponibilidad: obj.disponibilidad !== undefined ? obj.disponibilidad : true,
          ultimaActividad: obj.ultimaActividad || new Date().toISOString()
        };
      } catch (error) {
        logger.error({ error, ambulanciaId: obj.id }, 'Error resolving Ambulancia reference');
        return null;
      }
    }
  },

  /**
   * Resolve Rastreo entity reference
   * Called when another service references a Rastreo (tracking) by ID
   */
  Rastreo: {
    __resolveReference: async (obj, { redisClient, io }) => {
      try {
        if (!obj.id) {
          logger.warn({ obj }, 'Rastreo reference missing ID');
          return null;
        }

        // Try to get from Redis cache first
        const cached = await redisClient.get(`rastreo:${obj.id}`);
        if (cached) {
          return JSON.parse(cached);
        }

        // Return the object as-is from federation
        return {
          id: String(obj.id),
          despachoId: obj.despachoId ? String(obj.despachoId) : null,
          ubicacion: obj.ubicacion || { latitud: 0, longitud: 0 },
          velocidad: obj.velocidad || null,
          timestamp: obj.timestamp || new Date().toISOString()
        };
      } catch (error) {
        logger.error({ error, rastreoId: obj.id }, 'Error resolving Rastreo reference');
        return null;
      }
    }
  }
};

/**
 * Reference Resolver Hooks
 * Called when entities are resolved through federation
 */
export const referenceResolvers = {
  /**
   * Called when User reference is resolved
   * Used for caching and external service calls
   */
  onUserResolved: async (user, redisClient) => {
    try {
      // Cache user in Redis for 1 hour
      await redisClient.setex(
        `user:${user.id}`,
        3600,
        JSON.stringify(user)
      );
    } catch (error) {
      logger.warn({ error, userId: user.id }, 'Failed to cache user');
    }
  },

  /**
   * Called when Dispatch reference is resolved
   */
  onDispatchResolved: async (dispatch, redisClient, io) => {
    try {
      // Cache dispatch in Redis for 5 minutes (real-time data)
      await redisClient.setex(
        `dispatch:${dispatch.id}`,
        300,
        JSON.stringify(dispatch)
      );

      // Emit event for real-time updates
      if (io) {
        io.emit('dispatchFederated', {
          id: dispatch.id,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.warn({ error, despachoId: dispatch.id }, 'Failed to cache dispatch');
    }
  },

  /**
   * Called when Ambulancia reference is resolved
   */
  onAmbulanciaResolved: async (ambulancia, redisClient) => {
    try {
      // Cache ambulancia in Redis for 2 minutes
      await redisClient.setex(
        `ambulancia:${ambulancia.id}`,
        120,
        JSON.stringify(ambulancia)
      );
    } catch (error) {
      logger.warn({ error, ambulanciaId: ambulancia.id }, 'Failed to cache ambulancia');
    }
  }
};
