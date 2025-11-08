/**
 * Health Controller
 * Handles health check endpoints
 */

import { logger } from '../config/logger.js';

export class HealthController {
  constructor(healthCheckService) {
    this.healthCheckService = healthCheckService;
  }

  /**
   * GET /health
   */
  async health(req, res) {
    try {
      const status = this.healthCheckService.getStatus();

      return res.status(status.status === 'healthy' ? 200 : 503).json({
        status: status.status,
        service: 'ms-websocket',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    } catch (error) {
      logger.error({ error }, 'Health check failed');
      return res.status(503).json({
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * GET /health/detailed
   */
  async detailed(req, res) {
    try {
      const status = await this.healthCheckService.checkHealth();

      return res.status(status.status === 'healthy' ? 200 : 503).json(status);
    } catch (error) {
      logger.error({ error }, 'Detailed health check failed');
      return res.status(503).json({
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
}

export default HealthController;
