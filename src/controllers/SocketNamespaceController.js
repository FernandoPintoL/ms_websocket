/**
 * Socket Namespace Controller
 * Handles Socket.IO event listeners and emitters
 */

import { logger } from '../config/logger.js';
import Joi from 'joi';

export class SocketNamespaceController {
  constructor(socket, io, authService, dispatchService, broadcastService, eventService, redisClient) {
    this.socket = socket;
    this.io = io;
    this.authService = authService;
    this.dispatchService = dispatchService;
    this.broadcastService = broadcastService;
    this.eventService = eventService;
    this.redisClient = redisClient;
  }

  /**
   * Setup all event listeners for the socket
   */
  setupEventListeners() {
    // Connection events
    this.socket.on('ping', this.handlePing.bind(this));

    // User events
    this.socket.on('user:status', this.handleUserStatus.bind(this));

    // Dispatch events
    this.socket.on('dispatch:subscribe', this.handleDispatchSubscribe.bind(this));
    this.socket.on('dispatch:unsubscribe', this.handleDispatchUnsubscribe.bind(this));
    this.socket.on('dispatch:create', this.handleCreateDispatch.bind(this));
    this.socket.on('dispatch:status-update', this.handleDispatchStatusUpdate.bind(this));
    this.socket.on('dispatch:location-update', this.handleLocationUpdate.bind(this));

    // Ambulancia events
    this.socket.on('ambulancia:subscribe', this.handleAmbulanciaSubscribe.bind(this));
    this.socket.on('ambulancia:unsubscribe', this.handleAmbulanciaUnsubscribe.bind(this));

    logger.info({ socketId: this.socket.id, userId: this.socket.userId }, 'Event listeners setup');
  }

  /**
   * Handle ping event
   */
  async handlePing(callback) {
    try {
      const pongData = {
        timestamp: new Date().toISOString(),
        socketId: this.socket.id,
        serverTime: Date.now()
      };

      if (typeof callback === 'function') {
        callback(null, pongData);
      } else {
        this.socket.emit('pong', pongData);
      }

      logger.debug({ socketId: this.socket.id }, 'Ping received');
    } catch (error) {
      logger.error({ error, socketId: this.socket.id }, 'Error handling ping');
      if (typeof callback === 'function') {
        callback(error);
      }
    }
  }

  /**
   * Handle user status update
   */
  async handleUserStatus(data, callback) {
    try {
      const schema = Joi.object({
        status: Joi.string().valid('online', 'away', 'busy', 'offline').required(),
        metadata: Joi.object().optional()
      });

      const { error, value } = schema.validate(data);

      if (error) {
        return callback(new Error(`Validation failed: ${error.message}`));
      }

      // Join user room for notifications
      this.socket.join(`user:${this.socket.userId}`);

      // Broadcast user status
      await this.broadcastService.broadcastUserOnline(this.socket.userId, {
        name: this.socket.userName,
        role: this.socket.userRole,
        status: value.status,
        metadata: value.metadata
      });

      // Record event
      await this.eventService.recordEvent('user-status-changed', {
        userId: this.socket.userId,
        status: value.status
      });

      if (typeof callback === 'function') {
        callback(null, { success: true });
      }

      logger.info({ userId: this.socket.userId, status: value.status }, 'User status updated');
    } catch (error) {
      logger.error({ error, userId: this.socket.userId }, 'Error updating user status');
      if (typeof callback === 'function') {
        callback(error);
      }
    }
  }

  /**
   * Handle dispatch subscribe
   */
  async handleDispatchSubscribe(data, callback) {
    try {
      const schema = Joi.object({
        despachoId: Joi.number().required()
      });

      const { error, value } = schema.validate(data);

      if (error) {
        return callback(new Error(`Validation failed: ${error.message}`));
      }

      this.dispatchService.subscribeToDispatch(value.despachoId, this.socket);

      // Send initial dispatch data
      try {
        const despachoData = await this.dispatchService.getDespacho(
          value.despachoId,
          this.socket.handshake.auth.token
        );
        this.socket.emit('dispatch:initial-data', despachoData);
      } catch (error) {
        logger.warn({ error, despachoId: value.despachoId }, 'Failed to fetch initial dispatch data');
      }

      if (typeof callback === 'function') {
        callback(null, { success: true, despachoId: value.despachoId });
      }

      logger.info({
        socketId: this.socket.id,
        despachoId: value.despachoId
      }, 'User subscribed to dispatch');
    } catch (error) {
      logger.error({ error, socketId: this.socket.id }, 'Error subscribing to dispatch');
      if (typeof callback === 'function') {
        callback(error);
      }
    }
  }

  /**
   * Handle dispatch unsubscribe
   */
  async handleDispatchUnsubscribe(data, callback) {
    try {
      const schema = Joi.object({
        despachoId: Joi.number().required()
      });

      const { error, value } = schema.validate(data);

      if (error) {
        return callback(new Error(`Validation failed: ${error.message}`));
      }

      this.dispatchService.unsubscribeFromDispatch(value.despachoId, this.socket);

      if (typeof callback === 'function') {
        callback(null, { success: true });
      }

      logger.info({
        socketId: this.socket.id,
        despachoId: value.despachoId
      }, 'User unsubscribed from dispatch');
    } catch (error) {
      logger.error({ error, socketId: this.socket.id }, 'Error unsubscribing from dispatch');
      if (typeof callback === 'function') {
        callback(error);
      }
    }
  }

  /**
   * Handle create dispatch
   */
  async handleCreateDispatch(data, callback) {
    try {
      // Check permission
      if (!this.authService.hasPermission(
        { permissions: this.socket.userRole === 'dispatcher' ? ['create-despacho'] : [] },
        'create-despacho'
      )) {
        return callback(new Error('Permission denied'));
      }

      const schema = Joi.object({
        ubicacion_origen_lat: Joi.number().min(-90).max(90).required(),
        ubicacion_origen_lng: Joi.number().min(-180).max(180).required(),
        incidente: Joi.string().valid('accidente', 'emergencia_medica', 'traslado', 'otro').required(),
        prioridad: Joi.string().valid('baja', 'media', 'alta', 'critica').required()
      });

      const { error, value } = schema.validate(data);

      if (error) {
        return callback(new Error(`Validation failed: ${error.message}`));
      }

      const despacho = await this.dispatchService.createDespacho(
        value,
        this.socket.handshake.auth.token
      );

      if (typeof callback === 'function') {
        callback(null, { success: true, despachoId: despacho.id });
      }

      logger.info({ despachoId: despacho.id, userId: this.socket.userId }, 'Dispatch created');
    } catch (error) {
      logger.error({ error, userId: this.socket.userId }, 'Error creating dispatch');
      if (typeof callback === 'function') {
        callback(error);
      }
    }
  }

  /**
   * Handle dispatch status update
   */
  async handleDispatchStatusUpdate(data, callback) {
    try {
      const schema = Joi.object({
        despachoId: Joi.number().required(),
        estado: Joi.string().valid('pendiente', 'asignado', 'en_camino', 'en_sitio', 'trasladando', 'completado', 'cancelado').required()
      });

      const { error, value } = schema.validate(data);

      if (error) {
        return callback(new Error(`Validation failed: ${error.message}`));
      }

      const updated = await this.dispatchService.updateDespachoEstado(
        value.despachoId,
        value.estado,
        this.socket.handshake.auth.token
      );

      if (typeof callback === 'function') {
        callback(null, { success: true, dispatch: updated });
      }

      logger.info({
        despachoId: value.despachoId,
        estado: value.estado
      }, 'Dispatch status updated');
    } catch (error) {
      logger.error({ error }, 'Error updating dispatch status');
      if (typeof callback === 'function') {
        callback(error);
      }
    }
  }

  /**
   * Handle location update
   */
  async handleLocationUpdate(data, callback) {
    try {
      const schema = Joi.object({
        despachoId: Joi.number().required(),
        latitud: Joi.number().min(-90).max(90).required(),
        longitud: Joi.number().min(-180).max(180).required(),
        velocidad: Joi.number().min(0).optional(),
        altitud: Joi.number().optional(),
        precision: Joi.number().optional()
      });

      const { error, value } = schema.validate(data);

      if (error) {
        return callback(new Error(`Validation failed: ${error.message}`));
      }

      const rastreo = await this.dispatchService.addRastreo(
        value.despachoId,
        {
          latitud: value.latitud,
          longitud: value.longitud,
          velocidad: value.velocidad,
          altitud: value.altitud,
          precision: value.precision
        },
        this.socket.handshake.auth.token
      );

      if (typeof callback === 'function') {
        callback(null, { success: true, rastreo });
      }

      logger.debug({
        despachoId: value.despachoId,
        location: { lat: value.latitud, lng: value.longitud }
      }, 'Location updated');
    } catch (error) {
      logger.error({ error }, 'Error updating location');
      if (typeof callback === 'function') {
        callback(error);
      }
    }
  }

  /**
   * Handle ambulancia subscribe
   */
  async handleAmbulanciaSubscribe(data, callback) {
    try {
      const schema = Joi.object({
        ambulanciaId: Joi.number().required()
      });

      const { error, value } = schema.validate(data);

      if (error) {
        return callback(new Error(`Validation failed: ${error.message}`));
      }

      this.socket.join(`ambulancia:${value.ambulanciaId}`);

      if (typeof callback === 'function') {
        callback(null, { success: true, ambulanciaId: value.ambulanciaId });
      }

      logger.info({
        socketId: this.socket.id,
        ambulanciaId: value.ambulanciaId
      }, 'User subscribed to ambulancia');
    } catch (error) {
      logger.error({ error, socketId: this.socket.id }, 'Error subscribing to ambulancia');
      if (typeof callback === 'function') {
        callback(error);
      }
    }
  }

  /**
   * Handle ambulancia unsubscribe
   */
  async handleAmbulanciaUnsubscribe(data, callback) {
    try {
      const schema = Joi.object({
        ambulanciaId: Joi.number().required()
      });

      const { error, value } = schema.validate(data);

      if (error) {
        return callback(new Error(`Validation failed: ${error.message}`));
      }

      this.socket.leave(`ambulancia:${value.ambulanciaId}`);

      if (typeof callback === 'function') {
        callback(null, { success: true });
      }

      logger.info({
        socketId: this.socket.id,
        ambulanciaId: value.ambulanciaId
      }, 'User unsubscribed from ambulancia');
    } catch (error) {
      logger.error({ error, socketId: this.socket.id }, 'Error unsubscribing from ambulancia');
      if (typeof callback === 'function') {
        callback(error);
      }
    }
  }
}

export default SocketNamespaceController;
