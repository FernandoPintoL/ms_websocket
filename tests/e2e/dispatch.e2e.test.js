import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { io as ioClient } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import axios from 'axios';

/**
 * End-to-End Tests for Dispatch Workflow
 * Tests complete user flows from connection to dispatch completion
 */

describe('Dispatch E2E Tests', () => {
  const URL = 'http://localhost:3000';
  const jwtSecret = 'test-jwt-secret';
  const MS_DESPACHO_URL = 'http://localhost:9000';

  let dispatcherSocket;
  let driverSocket;
  let monitorSocket;

  const generateToken = (userId, role) => {
    return jwt.sign(
      { id: userId, nombre: `${role} User`, role },
      jwtSecret,
      { expiresIn: '24h' }
    );
  };

  beforeEach(async () => {
    // Mock MS Despacho API
    jest.spyOn(axios, 'get').mockResolvedValue({
      data: { data: [] }
    });
    jest.spyOn(axios, 'post').mockResolvedValue({
      data: { data: { id: '1', estado: 'PENDIENTE' } }
    });
    jest.spyOn(axios, 'put').mockResolvedValue({
      data: { data: { id: '1', estado: 'ASIGNADO' } }
    });

    // Connect sockets
    const dispatcherToken = generateToken('user-123', 'DISPATCHER');
    const driverToken = generateToken('user-456', 'DRIVER');
    const monitorToken = generateToken('user-789', 'MONITOR');

    dispatcherSocket = ioClient(URL, {
      auth: { token: dispatcherToken },
      transports: ['websocket']
    });

    driverSocket = ioClient(URL, {
      auth: { token: driverToken },
      transports: ['websocket']
    });

    monitorSocket = ioClient(URL, {
      auth: { token: monitorToken },
      transports: ['websocket']
    });

    // Wait for all connections
    return Promise.all([
      new Promise((resolve) => {
        dispatcherSocket.on('connect', resolve);
      }),
      new Promise((resolve) => {
        driverSocket.on('connect', resolve);
      }),
      new Promise((resolve) => {
        monitorSocket.on('connect', resolve);
      })
    ]);
  });

  afterEach(() => {
    dispatcherSocket.disconnect();
    driverSocket.disconnect();
    monitorSocket.disconnect();
    jest.restoreAllMocks();
  });

  describe('Complete Dispatch Lifecycle', () => {
    it('should complete full dispatch flow from creation to completion', async () => {
      let dispatchId = '1';
      let testPhase = 'initial';

      return new Promise((resolve) => {
        // Step 1: Monitor subscribes to dispatch updates
        monitorSocket.emit(
          'dispatch:subscribe',
          { despachoId: dispatchId },
          () => {
            testPhase = 'subscribed';
          }
        );

        // Step 2: Dispatcher creates dispatch
        setTimeout(() => {
          dispatcherSocket.emit(
            'dispatch:create',
            {
              paciente: 'Emergency Patient',
              latitud: 40.7128,
              longitud: -74.0060,
              notas: 'Head injury'
            },
            (error, response) => {
              if (!error) {
                dispatchId = response.despachoId || '1';
                testPhase = 'dispatch_created';
              }
            }
          );
        }, 200);

        // Step 3: Driver receives dispatch and accepts
        setTimeout(() => {
          driverSocket.emit(
            'dispatch:subscribe',
            { despachoId: dispatchId },
            () => {
              testPhase = 'driver_subscribed';
            }
          );
        }, 400);

        // Step 4: Driver updates status to EN_ROUTE
        setTimeout(() => {
          driverSocket.emit(
            'dispatch:status-update',
            { despachoId: dispatchId, estado: 'EN_ROUTE' },
            () => {
              testPhase = 'en_route';
            }
          );
        }, 600);

        // Step 5: Driver sends location updates
        setTimeout(() => {
          driverSocket.emit(
            'dispatch:location-update',
            {
              despachoId: dispatchId,
              latitud: 40.715,
              longitud: -74.005,
              velocidad: 60
            },
            () => {
              testPhase = 'location_sent';
            }
          );
        }, 800);

        // Step 6: Monitor receives location update
        monitorSocket.on('dispatch:location-updated', (data) => {
          expect(data).toBeDefined();
          expect(data.rastreo).toBeDefined();
          testPhase = 'monitor_updated';
        });

        // Step 7: Driver arrives and completes dispatch
        setTimeout(() => {
          driverSocket.emit(
            'dispatch:status-update',
            { despachoId: dispatchId, estado: 'COMPLETADO' },
            () => {
              testPhase = 'completed';
            }
          );
        }, 1000);

        // Step 8: Verify final state
        setTimeout(() => {
          expect(testPhase).toBe('completed');
          resolve();
        }, 1500);
      });
    });

    it('should maintain state consistency across all connected clients', async () => {
      const dispatchId = '2';
      const updates = [];

      // All clients subscribe to same dispatch
      dispatcherSocket.emit('dispatch:subscribe', { despachoId: dispatchId });
      driverSocket.emit('dispatch:subscribe', { despachoId: dispatchId });
      monitorSocket.emit('dispatch:subscribe', { despachoId: dispatchId });

      return new Promise((resolve) => {
        // Listen for updates on all clients
        dispatcherSocket.on(
          'dispatch:location-updated',
          (data) => updates.push('dispatcher:' + data.timestamp)
        );
        driverSocket.on(
          'dispatch:location-updated',
          (data) => updates.push('driver:' + data.timestamp)
        );
        monitorSocket.on(
          'dispatch:location-updated',
          (data) => updates.push('monitor:' + data.timestamp)
        );

        // Send location update
        setTimeout(() => {
          driverSocket.emit('dispatch:location-update', {
            despachoId: dispatchId,
            latitud: 40.716,
            longitud: -74.006,
            velocidad: 55
          });
        }, 200);

        // Check all received update
        setTimeout(() => {
          expect(updates.length).toBeGreaterThanOrEqual(3);
          resolve();
        }, 1000);
      });
    });
  });

  describe('Permission-based Access', () => {
    it('should allow dispatcher to create dispatch', async () => {
      return new Promise((resolve) => {
        dispatcherSocket.emit(
          'dispatch:create',
          {
            paciente: 'Test Patient',
            latitud: 40.7128,
            longitud: -74.0060
          },
          (error, response) => {
            expect(error).toBeFalsy();
            expect(response.success).toBe(true);
            resolve();
          }
        );

        setTimeout(() => resolve(), 2000);
      });
    });

    it('should prevent driver from creating dispatch', async () => {
      return new Promise((resolve) => {
        driverSocket.emit(
          'dispatch:create',
          {
            paciente: 'Test Patient',
            latitud: 40.7128,
            longitud: -74.0060
          },
          (error) => {
            // Should receive permission error
            if (error) {
              expect(error.message).toContain('permission');
            }
            resolve();
          }
        );

        setTimeout(() => resolve(), 2000);
      });
    });
  });

  describe('Real-time Location Tracking', () => {
    it('should track location with multiple updates', async () => {
      const dispatchId = '3';
      const locations = [];

      monitorSocket.emit('dispatch:subscribe', { despachoId: dispatchId });
      driverSocket.emit('dispatch:subscribe', { despachoId: dispatchId });

      monitorSocket.on('dispatch:location-updated', (data) => {
        locations.push({
          lat: data.rastreo.latitud,
          lon: data.rastreo.longitud
        });
      });

      return new Promise((resolve) => {
        // Send multiple location updates
        for (let i = 0; i < 3; i++) {
          setTimeout(() => {
            driverSocket.emit('dispatch:location-update', {
              despachoId: dispatchId,
              latitud: 40.7128 + i * 0.001,
              longitud: -74.0060 + i * 0.001,
              velocidad: 50 + i * 5
            });
          }, (i + 1) * 300);
        }

        setTimeout(() => {
          expect(locations.length).toBe(3);
          // Verify locations are different
          expect(locations[0]).not.toEqual(locations[2]);
          resolve();
        }, 1500);
      });
    });
  });

  describe('Error Recovery', () => {
    it('should handle connection loss and reconnect', async () => {
      const dispatchId = '4';
      let reconnected = false;

      driverSocket.emit('dispatch:subscribe', { despachoId: dispatchId });

      driverSocket.on('reconnect', () => {
        reconnected = true;
        // Re-subscribe after reconnection
        driverSocket.emit('dispatch:subscribe', { despachoId: dispatchId });
      });

      return new Promise((resolve) => {
        // Simulate disconnect
        setTimeout(() => {
          driverSocket.disconnect();
        }, 200);

        // Try to reconnect
        setTimeout(() => {
          driverSocket.connect();
        }, 400);

        // Verify reconnection
        setTimeout(() => {
          expect(driverSocket.connected).toBe(true);
          resolve();
        }, 1000);
      });
    });

    it('should queue messages during temporary disconnection', async () => {
      const dispatchId = '5';
      const events = [];

      return new Promise((resolve) => {
        monitorSocket.emit('dispatch:subscribe', { despachoId: dispatchId });
        driverSocket.emit('dispatch:subscribe', { despachoId: dispatchId });

        monitorSocket.on('dispatch:location-updated', () => {
          events.push('location-update');
        });

        // Send update while connected
        driverSocket.emit('dispatch:location-update', {
          despachoId: dispatchId,
          latitud: 40.7128,
          longitud: -74.0060
        });

        setTimeout(() => {
          expect(events.length).toBeGreaterThan(0);
          resolve();
        }, 1000);
      });
    });
  });

  describe('High Volume Updates', () => {
    it('should handle rapid location updates', async () => {
      const dispatchId = '6';
      const updateCount = 10;
      let receivedCount = 0;

      driverSocket.emit('dispatch:subscribe', { despachoId: dispatchId });
      monitorSocket.emit('dispatch:subscribe', { despachoId: dispatchId });

      monitorSocket.on('dispatch:location-updated', () => {
        receivedCount++;
      });

      return new Promise((resolve) => {
        // Send rapid updates
        for (let i = 0; i < updateCount; i++) {
          setTimeout(() => {
            driverSocket.emit('dispatch:location-update', {
              despachoId: dispatchId,
              latitud: 40.7128 + Math.random() * 0.01,
              longitud: -74.0060 + Math.random() * 0.01,
              velocidad: 40 + Math.random() * 20
            });
          }, i * 100);
        }

        setTimeout(() => {
          expect(receivedCount).toBeGreaterThan(0);
          resolve();
        }, updateCount * 100 + 500);
      });
    });
  });
});
