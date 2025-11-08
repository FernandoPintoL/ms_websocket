/**
 * Metrics Controller
 * Handles Prometheus metrics endpoint
 */

import { logger } from '../config/logger.js';

let connectionCount = 0;
let eventCount = 0;
let errorCount = 0;

export class MetricsController {
  /**
   * GET /metrics (Prometheus format)
   */
  metrics(req, res) {
    try {
      const uptime = process.uptime();
      const memUsage = process.memoryUsage();

      const metricsOutput = `
# HELP ms_websocket_uptime_seconds Service uptime in seconds
# TYPE ms_websocket_uptime_seconds gauge
ms_websocket_uptime_seconds ${uptime}

# HELP ms_websocket_connections_total Total WebSocket connections
# TYPE ms_websocket_connections_total gauge
ms_websocket_connections_total ${connectionCount}

# HELP ms_websocket_events_total Total events processed
# TYPE ms_websocket_events_total counter
ms_websocket_events_total ${eventCount}

# HELP ms_websocket_errors_total Total errors
# TYPE ms_websocket_errors_total counter
ms_websocket_errors_total ${errorCount}

# HELP process_memory_heap_used_bytes Heap memory used in bytes
# TYPE process_memory_heap_used_bytes gauge
process_memory_heap_used_bytes ${memUsage.heapUsed}

# HELP process_memory_heap_total_bytes Total heap memory in bytes
# TYPE process_memory_heap_total_bytes gauge
process_memory_heap_total_bytes ${memUsage.heapTotal}

# HELP process_memory_rss_bytes Resident set size in bytes
# TYPE process_memory_rss_bytes gauge
process_memory_rss_bytes ${memUsage.rss}

# HELP nodejs_version_info Node.js version info
# TYPE nodejs_version_info gauge
nodejs_version_info{version="${process.version.replace('v', '')}"} 1
      `.trim();

      res.setHeader('Content-Type', 'text/plain; version=0.0.4');
      return res.send(metricsOutput);
    } catch (error) {
      logger.error({ error }, 'Metrics generation failed');
      return res.status(500).json({
        error: 'Failed to generate metrics',
        message: error.message
      });
    }
  }

  /**
   * Increment connection count
   */
  static incrementConnections() {
    connectionCount++;
  }

  /**
   * Decrement connection count
   */
  static decrementConnections() {
    connectionCount = Math.max(0, connectionCount - 1);
  }

  /**
   * Increment event count
   */
  static incrementEvents() {
    eventCount++;
  }

  /**
   * Increment error count
   */
  static incrementErrors() {
    errorCount++;
  }

  /**
   * Get metrics
   */
  static getMetrics() {
    return {
      connectionCount,
      eventCount,
      errorCount,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };
  }
}

export default MetricsController;
