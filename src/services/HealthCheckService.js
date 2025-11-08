/**
 * Health Check Service
 * Monitors system health and dependencies
 */

import axios from 'axios';
import { logger } from '../config/logger.js';

export class HealthCheckService {
  constructor(redisClient) {
    this.redisClient = redisClient;
    this.healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {}
    };
  }

  /**
   * Perform health check
   */
  async checkHealth() {
    try {
      const checks = {
        redis: await this.checkRedis(),
        msAuth: await this.checkMicroservice('MS Auth', process.env.MS_AUTH_URL),
        msDespacho: await this.checkMicroservice('MS Despacho', process.env.MS_DESPACHO_URL),
        msDecision: await this.checkMicroservice('MS Decision', process.env.MS_DECISION_URL),
        memory: this.checkMemory(),
        uptime: this.checkUptime()
      };

      this.healthStatus = {
        status: Object.values(checks).some(c => !c.healthy) ? 'degraded' : 'healthy',
        timestamp: new Date().toISOString(),
        checks,
        uptime: process.uptime()
      };

      logger.debug(this.healthStatus, 'Health check completed');
      return this.healthStatus;
    } catch (error) {
      logger.error({ error }, 'Health check failed');

      this.healthStatus = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
        checks: {}
      };

      return this.healthStatus;
    }
  }

  /**
   * Check Redis connection
   */
  async checkRedis() {
    try {
      const start = Date.now();
      await this.redisClient.ping();
      const latency = Date.now() - start;

      return {
        healthy: true,
        latency_ms: latency,
        message: 'Redis connected'
      };
    } catch (error) {
      logger.error({ error }, 'Redis health check failed');
      return {
        healthy: false,
        error: error.message,
        message: 'Redis unavailable'
      };
    }
  }

  /**
   * Check microservice availability
   */
  async checkMicroservice(name, url) {
    try {
      const start = Date.now();
      const response = await axios.get(`${url}/health`, {
        timeout: 5000
      });
      const latency = Date.now() - start;

      return {
        healthy: response.status === 200,
        latency_ms: latency,
        message: `${name} is healthy`
      };
    } catch (error) {
      logger.warn({ error: error.message, service: name }, 'Microservice health check failed');
      return {
        healthy: false,
        error: error.message,
        message: `${name} unavailable`
      };
    }
  }

  /**
   * Check memory usage
   */
  checkMemory() {
    const memUsage = process.memoryUsage();
    const heapPercentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    return {
      healthy: heapPercentage < 90,
      heapUsed_mb: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal_mb: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapPercentage: heapPercentage.toFixed(2),
      rss_mb: Math.round(memUsage.rss / 1024 / 1024)
    };
  }

  /**
   * Check system uptime
   */
  checkUptime() {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);

    return {
      healthy: true,
      uptime_seconds: Math.round(uptime),
      uptime_readable: `${hours}h ${minutes}m`,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get health status
   */
  getStatus() {
    return this.healthStatus;
  }

  /**
   * Check if system is healthy
   */
  isHealthy() {
    return this.healthStatus.status === 'healthy';
  }

  /**
   * Check if system is degraded
   */
  isDegraded() {
    return this.healthStatus.status === 'degraded';
  }
}

export default HealthCheckService;
