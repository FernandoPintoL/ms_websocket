import { gql } from 'graphql-tag';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { entityResolvers } from './resolvers/entityResolvers.js';

/**
 * GraphQL Schema for MS WebSocket
 * Apollo Federation v2 Subgraph
 * Includes Queries, Mutations, and Subscriptions for real-time dispatch management
 */
export const typeDefs = gql`
  # ============================================
  # APOLLO FEDERATION v2
  # ============================================
  extend schema
    @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key"])

  # ============================================
  # SCALAR TYPES
  # ============================================

  scalar DateTime
  scalar JSON

  # ============================================
  # ENUMS
  # ============================================

  enum DispatchStatusEnum {
    PENDIENTE
    ASIGNADO
    EN_ROUTE
    LLEGADA
    COMPLETADO
    CANCELADO
  }

  enum UserRoleEnum {
    ADMIN
    DISPATCHER
    DRIVER
    MONITOR
  }

  enum ConnectionStatusEnum {
    CONNECTED
    DISCONNECTED
    IDLE
    RECONNECTING
  }

  # ============================================
  # TYPES
  # ============================================

  type User @key(fields: "id") {
    id: ID!
    nombre: String!
    email: String!
    role: UserRoleEnum!
    isOnline: Boolean!
    lastSeen: DateTime!
    createdAt: DateTime!
  }

  type Dispatch @key(fields: "id") {
    id: ID!
    numero: String!
    estado: DispatchStatusEnum!
    paciente: String
    ubicacion: Location!
    ambulanciaId: ID
    ambulanciaPlaca: String
    driverName: String
    notas: String
    fechaCreacion: DateTime!
    fechaActualizacion: DateTime!
    tiempoEstimado: Int
    prioridad: Int
  }

  type Location {
    latitud: Float!
    longitud: Float!
    altitud: Float
    accuracyMeters: Float
  }

  type Rastreo @key(fields: "id") {
    id: ID!
    despachoId: ID!
    ubicacion: Location!
    velocidad: Float
    timestamp: DateTime!
  }

  type Ambulancia @key(fields: "id") {
    id: ID!
    placa: String!
    estado: String!
    ubicacion: Location!
    driverName: String
    disponibilidad: Boolean!
    ultimaActividad: DateTime!
  }

  type Connection {
    socketId: ID!
    userId: ID!
    connectedAt: DateTime!
    lastActivity: DateTime!
    metadata: JSON
  }

  type Session {
    sessionId: ID!
    userId: ID!
    createdAt: DateTime!
    lastActivity: DateTime!
    isActive: Boolean!
    metadata: JSON
  }

  type Event {
    id: ID!
    type: String!
    data: JSON!
    metadata: JSON
    timestamp: DateTime!
  }

  type BroadcastMessage {
    channel: String!
    message: String!
    sender: ID!
    timestamp: DateTime!
  }

  type HealthStatus {
    status: String!
    service: String!
    version: String!
    uptime: Float!
    checks: JSON
  }

  type ConnectionStats {
    total: Int!
    byUser: JSON!
    byStatus: JSON!
    topUsers: [UserConnection!]!
  }

  type UserConnection {
    userId: ID!
    connectionCount: Int!
  }

  type OnlineUser {
    userId: ID!
    nombre: String!
    role: UserRoleEnum!
    connectionCount: Int!
    lastActivity: DateTime!
  }

  type DispatchUpdate {
    dispatch: Dispatch!
    changeType: String!
    previousState: JSON
    timestamp: DateTime!
  }

  type LocationUpdate {
    despachoId: ID!
    rastreo: Rastreo!
    timestamp: DateTime!
  }

  type UserStatusChange {
    userId: ID!
    status: String!
    timestamp: DateTime!
  }

  type MessageBroadcast {
    id: ID!
    channel: String!
    message: String!
    sender: ID!
    senderName: String!
    timestamp: DateTime!
  }

  type EventHistory {
    events: [Event!]!
    total: Int!
    limit: Int!
    offset: Int!
  }

  type ApiResponse {
    success: Boolean!
    message: String!
    data: JSON
  }

  # ============================================
  # QUERIES
  # ============================================

  type Query {
    # Dispatch Queries
    dispatch(id: ID!): Dispatch
    despachos(
      estado: DispatchStatusEnum
      limit: Int
      offset: Int
    ): [Dispatch!]!
    despachosByAmbulancia(ambulanciaId: ID!): [Dispatch!]!

    # User Queries
    user(id: ID!): User
    onlineUsers(limit: Int): [OnlineUser!]!
    currentUser: User

    # Connection Queries
    connection(socketId: ID!): Connection
    userConnections(userId: ID!): [Connection!]!
    connectionStats: ConnectionStats!
    activeConnections(limit: Int): [Connection!]!

    # Session Queries
    session(sessionId: ID!): Session
    userSessions(userId: ID!): [Session!]!
    activeSessions(userId: ID!): [Session!]!
    sessionStats: JSON!

    # Event Queries
    events(type: String, limit: Int, offset: Int): EventHistory!
    eventsByUser(userId: ID!, limit: Int): [Event!]!
    eventStatistics: JSON!

    # Ambulancia Queries
    ambulancia(id: ID!): Ambulancia
    ambulancias(disponibilidad: Boolean): [Ambulancia!]!
    ambulanciasByUbicacion(
      latitud: Float!
      longitud: Float!
      radiusKm: Float!
    ): [Ambulancia!]!

    # Rastreo Queries
    rastreoHistoria(despachoId: ID!, limit: Int): [Rastreo!]!

    # Health Queries
    health: HealthStatus!
    healthDetailed: JSON!

    # Broadcast/Channel Queries
    channelHistory(channel: String!, limit: Int): [MessageBroadcast!]!
  }

  # ============================================
  # MUTATIONS
  # ============================================

  type Mutation {
    # Dispatch Mutations
    createDispatch(
      paciente: String
      latitud: Float!
      longitud: Float!
      notas: String
    ): Dispatch!
    updateDispatchStatus(
      despachoId: ID!
      estado: DispatchStatusEnum!
    ): Dispatch!
    cancelDispatch(despachoId: ID!, razon: String): Dispatch!

    # Location Mutations
    updateLocation(
      despachoId: ID!
      latitud: Float!
      longitud: Float!
      velocidad: Float
    ): Rastreo!

    # Session Mutations
    createSession(metadata: JSON): Session!
    updateSession(sessionId: ID!, metadata: JSON): Session!
    deleteSession(sessionId: ID!): ApiResponse!
    deleteAllSessions: ApiResponse!

    # Connection Mutations
    markConnectionActive(socketId: ID!): Connection!
    updateConnectionMetadata(socketId: ID!, metadata: JSON): Connection!

    # Broadcast Mutations
    broadcastMessage(channel: String!, message: String!): BroadcastMessage!
    sendDirectMessage(userId: ID!, message: String!): BroadcastMessage!

    # Event Mutations
    clearEventHistory(eventType: String!): ApiResponse!

    # User Mutations
    updateUserStatus(status: String!): User!
  }

  # ============================================
  # SUBSCRIPTIONS (Real-time Updates)
  # ============================================

  type Subscription {
    # Dispatch Subscriptions
    dispatchCreated: Dispatch!
    dispatchUpdated(despachoId: ID!): DispatchUpdate!
    dispatchStatusChanged(despachoId: ID!): Dispatch!
    dispatchCanceled(despachoId: ID!): Dispatch!

    # Location Subscriptions
    locationUpdated(despachoId: ID!): LocationUpdate!
    ambulanciaLocationUpdated(ambulanciaId: ID!): Ambulancia!

    # User Subscriptions
    userStatusChanged(userId: ID!): UserStatusChange!
    onlineUsersChanged: [OnlineUser!]!
    userConnected(userId: ID!): User!
    userDisconnected(userId: ID!): User!

    # Broadcast Subscriptions
    messageBroadcast(channel: String!): MessageBroadcast!
    directMessage(fromUserId: ID!): MessageBroadcast!

    # Event Subscriptions
    eventOccurred(eventType: String): Event!

    # Connection Subscriptions
    connectionCreated: Connection!
    connectionClosed(socketId: ID!): Connection!
  }
`;

// ============================================
// RESOLVERS
// ============================================

export const createResolvers = (services) => {
  const {
    authService,
    dispatchService,
    connectionService,
    broadcastService,
    eventService,
    healthCheckService
  } = services;

  return {
    Query: {
      // Dispatch Queries
      dispatch: async (_, { id }, { userId }) => {
        if (!userId) throw new Error('Not authenticated');
        return await dispatchService.getDespacho(id);
      },

      despachos: async (_, { estado, limit = 100, offset = 0 }, { userId }) => {
        if (!userId) throw new Error('Not authenticated');
        return await dispatchService.getDespachos(
          { estado, limit, offset },
          null
        );
      },

      despachosByAmbulancia: async (_, { ambulanciaId }, { userId }) => {
        if (!userId) throw new Error('Not authenticated');
        return await dispatchService.getDespachos({ ambulanciaId });
      },

      // User Queries
      currentUser: async (_, __, { userId, user }) => {
        if (!userId) throw new Error('Not authenticated');
        return user;
      },

      onlineUsers: async (_, { limit = 50 }, { userId }) => {
        if (!userId) throw new Error('Not authenticated');
        // This would be populated from connectionService
        return [];
      },

      // Connection Queries
      connection: async (_, { socketId }, { userId }) => {
        if (!userId) throw new Error('Not authenticated');
        return await connectionService.getConnection(socketId);
      },

      userConnections: async (_, { userId }, { userId: currentUserId }) => {
        if (!currentUserId) throw new Error('Not authenticated');
        return await connectionService.getUserConnections(userId);
      },

      connectionStats: async (_, __, { userId }) => {
        if (!userId) throw new Error('Not authenticated');
        // Return connection statistics
        const total = await connectionService.getConnectionCount();
        return {
          total,
          byUser: {},
          byStatus: {},
          topUsers: []
        };
      },

      // Health Queries
      health: async (_, __, { userId }) => {
        if (!userId) throw new Error('Not authenticated');
        const status = await healthCheckService.checkHealth();
        return {
          status: status.status,
          service: 'ms-websocket',
          version: '1.0.0',
          uptime: process.uptime(),
          checks: status.checks
        };
      }
    },

    Mutation: {
      // Dispatch Mutations
      createDispatch: async (
        _,
        { paciente, latitud, longitud, notas },
        { userId, token }
      ) => {
        if (!userId) throw new Error('Not authenticated');
        return await dispatchService.createDespacho(
          { paciente, latitud, longitud, notas },
          token
        );
      },

      updateDispatchStatus: async (
        _,
        { despachoId, estado },
        { userId, token }
      ) => {
        if (!userId) throw new Error('Not authenticated');
        const updated = await dispatchService.updateDespachoEstado(
          despachoId,
          estado,
          token
        );
        // Broadcast update to all subscribers
        await broadcastService.broadcastDispatchEvent(
          despachoId,
          'statusChanged',
          { estado, updatedAt: new Date() }
        );
        return updated;
      },

      // Location Mutations
      updateLocation: async (
        _,
        { despachoId, latitud, longitud, velocidad },
        { userId, token }
      ) => {
        if (!userId) throw new Error('Not authenticated');
        const rastreo = await dispatchService.addRastreo(
          despachoId,
          { latitud, longitud, velocidad },
          token
        );
        // Broadcast location update
        await broadcastService.broadcastDispatchEvent(
          despachoId,
          'locationUpdated',
          rastreo
        );
        return rastreo;
      },

      // Broadcast Mutations
      broadcastMessage: async (
        _,
        { channel, message },
        { userId, user }
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
        await broadcastService.publishEvent(channel, broadcast);
        return broadcast;
      }
    },

    Subscription: {
      // Dispatch Subscriptions
      dispatchUpdated: {
        subscribe: async (_, { despachoId }, { pubsub }) => {
          const channel = `dispatch:${despachoId}:updated`;
          return pubsub.asyncIterator([channel]);
        }
      },

      dispatchCreated: {
        subscribe: async (_, __, { pubsub }) => {
          return pubsub.asyncIterator(['dispatch:created']);
        }
      },

      // Location Subscriptions
      locationUpdated: {
        subscribe: async (_, { despachoId }, { pubsub }) => {
          const channel = `location:${despachoId}:updated`;
          return pubsub.asyncIterator([channel]);
        }
      },

      // User Subscriptions
      userStatusChanged: {
        subscribe: async (_, { userId }, { pubsub }) => {
          const channel = `user:${userId}:statusChanged`;
          return pubsub.asyncIterator([channel]);
        }
      },

      onlineUsersChanged: {
        subscribe: async (_, __, { pubsub }) => {
          return pubsub.asyncIterator(['onlineUsers:changed']);
        }
      },

      // Broadcast Subscriptions
      messageBroadcast: {
        subscribe: async (_, { channel }, { pubsub }) => {
          return pubsub.asyncIterator([`broadcast:${channel}`]);
        }
      },

      // Event Subscriptions
      eventOccurred: {
        subscribe: async (_, { eventType }, { pubsub }) => {
          const channel = eventType ? `event:${eventType}` : 'event:*';
          return pubsub.asyncIterator([channel]);
        }
      }
    }
  };
};

/**
 * Create GraphQL Schema
 * Combines type definitions and resolvers into a complete federation subgraph schema
 */
export const createGraphQLSchema = (io, redisClient) => {
  // Create resolvers with services
  const resolvers = createResolvers({
    io,
    redisClient
  });

  // Merge entity resolvers for federation
  const allResolvers = {
    ...resolvers,
    ...entityResolvers
  };

  // Build federation subgraph schema directly
  try {
    return buildSubgraphSchema([
      {
        typeDefs,
        resolvers: allResolvers
      }
    ]);
  } catch (error) {
    console.error('Error building subgraph schema:', error);
    // Fallback to regular schema if federation fails
    return makeExecutableSchema({
      typeDefs,
      resolvers: allResolvers
    });
  }
};
