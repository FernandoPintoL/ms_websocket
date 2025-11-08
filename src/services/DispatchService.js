/**
 * Dispatch Service
 * Handles dispatch-related business logic
 * Communicates with MS Despacho
 */

import axios from 'axios';
import { logger } from '../config/logger.js';

export class DispatchService {
  constructor(io) {
    this.io = io;
    this.msDespachoUrl = process.env.MS_DESPACHO_URL || 'http://localhost:8001';
    this.msDespachoApiEndpoint = process.env.MS_DESPACHO_API_ENDPOINT || '/api/v1';
    this.timeout = parseInt(process.env.MS_AUTH_TIMEOUT || '10000');
    this.axiosInstance = axios.create({
      timeout: this.timeout,
      baseURL: this.msDespachoUrl
    });
  }

  /**
   * Get all despachos
   * @param {Object} filters - Query filters
   * @param {string} token - JWT token
   * @returns {Promise<Array>} - Array of despachos
   */
  async getDespachos(filters = {}, token) {
    try {
      const response = await this.axiosInstance.get(
        `${this.msDespachoApiEndpoint}/despachos`,
        {
          params: filters,
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      logger.debug({ count: response.data.data?.length }, 'Despachos retrieved');
      return response.data.data || [];
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get despachos');
      throw error;
    }
  }

  /**
   * Get single despacho by ID
   * @param {number} id - Despacho ID
   * @param {string} token - JWT token
   * @returns {Promise<Object>} - Despacho data
   */
  async getDespacho(id, token) {
    try {
      const response = await this.axiosInstance.get(
        `${this.msDespachoApiEndpoint}/despachos/${id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      logger.debug({ despachoId: id }, 'Despacho retrieved');
      return response.data.data;
    } catch (error) {
      logger.error({ error: error.message, despachoId: id }, 'Failed to get despacho');
      throw error;
    }
  }

  /**
   * Create new despacho
   * @param {Object} data - Despacho data
   * @param {string} token - JWT token
   * @returns {Promise<Object>} - Created despacho
   */
  async createDespacho(data, token) {
    try {
      const response = await this.axiosInstance.post(
        `${this.msDespachoApiEndpoint}/despachos`,
        data,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info({ despachoId: response.data.data?.id }, 'Despacho created');

      // Broadcast new dispatch event
      this.io.emit('dispatch:created', response.data.data);

      return response.data.data;
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to create despacho');
      throw error;
    }
  }

  /**
   * Update despacho status
   * @param {number} id - Despacho ID
   * @param {string} estado - New status
   * @param {string} token - JWT token
   * @returns {Promise<Object>} - Updated despacho
   */
  async updateDespachoEstado(id, estado, token) {
    try {
      const response = await this.axiosInstance.patch(
        `${this.msDespachoApiEndpoint}/despachos/${id}`,
        { estado },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info({ despachoId: id, estado }, 'Despacho status updated');

      // Broadcast status change event
      this.io.to(`dispatch:${id}`).emit('dispatch:status-changed', {
        despachoId: id,
        estado,
        timestamp: new Date().toISOString()
      });

      return response.data.data;
    } catch (error) {
      logger.error({ error: error.message, despachoId: id }, 'Failed to update despacho');
      throw error;
    }
  }

  /**
   * Add GPS tracking point
   * @param {number} despachoId - Despacho ID
   * @param {Object} location - GPS location data
   * @param {string} token - JWT token
   * @returns {Promise<Object>} - Created tracking record
   */
  async addRastreo(despachoId, location, token) {
    try {
      const response = await this.axiosInstance.post(
        `${this.msDespachoApiEndpoint}/despachos/${despachoId}/rastreo`,
        location,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.debug({ despachoId, location }, 'Rastreo added');

      // Broadcast location update
      this.io.to(`dispatch:${despachoId}`).emit('dispatch:location-updated', {
        despachoId,
        location: response.data.data,
        timestamp: new Date().toISOString()
      });

      return response.data.data;
    } catch (error) {
      logger.error({ error: error.message, despachoId }, 'Failed to add rastreo');
      throw error;
    }
  }

  /**
   * Get despacho tracking history
   * @param {number} despachoId - Despacho ID
   * @param {string} token - JWT token
   * @returns {Promise<Array>} - Array of tracking points
   */
  async getRastreoHistoria(despachoId, token) {
    try {
      const response = await this.axiosInstance.get(
        `${this.msDespachoApiEndpoint}/despachos/${despachoId}/rastreo`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      logger.debug({ despachoId, count: response.data.data?.length }, 'Rastreo historia retrieved');
      return response.data.data || [];
    } catch (error) {
      logger.error({ error: error.message, despachoId }, 'Failed to get rastreo history');
      throw error;
    }
  }

  /**
   * Get ambulancia details
   * @param {number} ambulanciaId - Ambulancia ID
   * @param {string} token - JWT token
   * @returns {Promise<Object>} - Ambulancia data
   */
  async getAmbulancia(ambulanciaId, token) {
    try {
      const response = await this.axiosInstance.get(
        `${this.msDespachoApiEndpoint}/ambulancias/${ambulanciaId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      logger.debug({ ambulanciaId }, 'Ambulancia retrieved');
      return response.data.data;
    } catch (error) {
      logger.error({ error: error.message, ambulanciaId }, 'Failed to get ambulancia');
      throw error;
    }
  }

  /**
   * Subscribe to dispatch updates
   * @param {string} despachoId - Dispatch ID to subscribe to
   * @param {Object} socket - Socket.IO socket instance
   */
  subscribeToDispatch(despachoId, socket) {
    const roomName = `dispatch:${despachoId}`;
    socket.join(roomName);
    logger.info({ despachoId, socketId: socket.id }, 'User subscribed to dispatch');
  }

  /**
   * Unsubscribe from dispatch updates
   * @param {string} despachoId - Dispatch ID to unsubscribe from
   * @param {Object} socket - Socket.IO socket instance
   */
  unsubscribeFromDispatch(despachoId, socket) {
    const roomName = `dispatch:${despachoId}`;
    socket.leave(roomName);
    logger.info({ despachoId, socketId: socket.id }, 'User unsubscribed from dispatch');
  }
}

export default DispatchService;
