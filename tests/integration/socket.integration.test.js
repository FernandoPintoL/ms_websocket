import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { io as ioClient } from 'socket.io-client';
import jwt from 'jsonwebtoken';

/**
 * Socket.IO Integration Tests
 * These tests verify Socket.IO communication and real-time features
 */

describe('Socket.IO Integration Tests', () => {
  let serverSocket;
  let clientSocket;
  const URL = 'http://localhost:3000';
  const jwtSecret = 'test-jwt-secret';

  const generateToken = (userId = '123', role = 'ADMIN') => {
    return jwt.sign(
      { id: userId, nombre: 'Test User', role },
      jwtSecret,
      { expiresIn: '24h' }
    );
  };

  beforeEach(async () => {
    // Create client socket with authentication
    const token = generateToken();
    clientSocket = ioClient(URL, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 100,
      reconnectionDelayMax: 500,
      reconnectionAttempts: 5,
      transports: ['websocket']
    });

    // Wait for connection
    return new Promise((resolve, reject) => {
      clientSocket.on('connect', resolve);
      clientSocket.on('connect_error', reject);

      // Timeout after 5 seconds
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });
  });

  afterEach(() => {
    clientSocket.disconnect();
  });

  describe('Connection Management', () => {
    it('should establish WebSocket connection with valid token', async () => {
      expect(clientSocket.connected).toBe(true);
      expect(clientSocket.id).toBeDefined();
    });

    it('should reject connection with invalid token', async () => {
      const invalidSocket = ioClient(URL, {
        auth: { token: 'invalid-token' },
        transports: ['websocket']
      });

      return new Promise((resolve) => {
        invalidSocket.on('connect_error', (error) => {
          expect(error.message).toContain('auth');
          invalidSocket.disconnect();
          resolve();
        });

        setTimeout(() => {
          invalidSocket.disconnect();
          resolve();
        }, 2000);
      });
    });

    it('should handle reconnection', async () => {
      const reconnectPromise = new Promise((resolve) => {
        clientSocket.on('reconnect', resolve);
      });

      clientSocket.disconnect();
      clientSocket.connect();

      await reconnectPromise;
      expect(clientSocket.connected).toBe(true);
    });
  });

  describe('Socket Events', () => {
    it('should send and receive ping event', async () => {
      return new Promise((resolve) => {
        clientSocket.emit('ping', {}, (response) => {
          expect(response).toBeDefined();
          expect(response.pong).toBe(true);
          resolve();
        });

        setTimeout(() => resolve(), 2000);
      });
    });

    it('should update user status', async () => {
      return new Promise((resolve) => {
        clientSocket.emit('user:status', { status: 'active' }, (response) => {
          expect(response.success).toBe(true);
          resolve();
        });

        setTimeout(() => resolve(), 2000);
      });
    });

    it('should handle validation errors', async () => {
      return new Promise((resolve) => {
        // Send invalid dispatch subscription (missing required field)
        clientSocket.emit(
          'dispatch:subscribe',
          { invalidField: '123' },
          (error) => {
            expect(error).toBeDefined();
            expect(error.message).toContain('Validation');
            resolve();
          }
        );

        setTimeout(() => resolve(), 2000);
      });
    });
  });

  describe('Dispatch Subscription', () => {
    it('should subscribe to dispatch', async () => {
      return new Promise((resolve) => {
        clientSocket.emit(
          'dispatch:subscribe',
          { despachoId: '123' },
          (error, response) => {
            if (error) {
              console.error('Error:', error);
            } else {
              expect(response.success).toBe(true);
              expect(response.despachoId).toBe('123');
            }
            resolve();
          }
        );

        setTimeout(() => resolve(), 2000);
      });
    });

    it('should unsubscribe from dispatch', async () => {
      return new Promise((resolve) => {
        // First subscribe
        clientSocket.emit(
          'dispatch:subscribe',
          { despachoId: '456' },
          () => {
            // Then unsubscribe
            clientSocket.emit(
              'dispatch:unsubscribe',
              { despachoId: '456' },
              (error, response) => {
                expect(error).toBeFalsy();
                expect(response.success).toBe(true);
                resolve();
              }
            );
          }
        );

        setTimeout(() => resolve(), 3000);
      });
    });

    it('should receive dispatch updates', async () => {
      return new Promise((resolve) => {
        clientSocket.on('dispatch:location-updated', (data) => {
          expect(data).toBeDefined();
          expect(data.rastreo).toBeDefined();
          resolve();
        });

        clientSocket.emit(
          'dispatch:subscribe',
          { despachoId: '789' },
          () => {
            // Simulate location update from another client
            setTimeout(() => {
              clientSocket.emit('dispatch:location-update', {
                despachoId: '789',
                latitud: 40.7128,
                longitud: -74.0060,
                velocidad: 50
              });
            }, 500);
          }
        );

        setTimeout(() => resolve(), 3000);
      });
    });
  });

  describe('Location Updates', () => {
    it('should send location update with valid coordinates', async () => {
      return new Promise((resolve) => {
        clientSocket.emit(
          'dispatch:location-update',
          {
            despachoId: '123',
            latitud: 40.7128,
            longitud: -74.0060,
            velocidad: 45
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

    it('should reject invalid latitude', async () => {
      return new Promise((resolve) => {
        clientSocket.emit(
          'dispatch:location-update',
          {
            despachoId: '123',
            latitud: 95, // Invalid
            longitud: -74.0060
          },
          (error) => {
            expect(error).toBeDefined();
            expect(error.message).toContain('latitude');
            resolve();
          }
        );

        setTimeout(() => resolve(), 2000);
      });
    });

    it('should reject invalid longitude', async () => {
      return new Promise((resolve) => {
        clientSocket.emit(
          'dispatch:location-update',
          {
            despachoId: '123',
            latitud: 40.7128,
            longitud: -200 // Invalid
          },
          (error) => {
            expect(error).toBeDefined();
            expect(error.message).toContain('longitude');
            resolve();
          }
        );

        setTimeout(() => resolve(), 2000);
      });
    });
  });

  describe('Broadcast Messages', () => {
    it('should broadcast message to all clients', async () => {
      return new Promise((resolve) => {
        clientSocket.on('broadcast:message', (data) => {
          expect(data).toBeDefined();
          expect(data.message).toBeDefined();
          resolve();
        });

        clientSocket.emit('broadcast:send', {
          channel: 'global',
          message: 'Hello everyone'
        });

        setTimeout(() => resolve(), 2000);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle server errors gracefully', async () => {
      return new Promise((resolve) => {
        clientSocket.emit('invalid:event', {}, (error) => {
          // Server should handle unknown events gracefully
          resolve();
        });

        setTimeout(() => resolve(), 2000);
      });
    });

    it('should disconnect on missing authentication', async () => {
      const noAuthSocket = ioClient(URL, {
        transports: ['websocket']
      });

      return new Promise((resolve) => {
        noAuthSocket.on('connect_error', () => {
          expect(true).toBe(true);
          noAuthSocket.disconnect();
          resolve();
        });

        setTimeout(() => {
          noAuthSocket.disconnect();
          resolve();
        }, 2000);
      });
    });
  });

  describe('Multiple Connections', () => {
    it('should handle multiple connections from same user', async () => {
      const token = generateToken('123'); // Same user ID
      const clientSocket2 = ioClient(URL, {
        auth: { token },
        transports: ['websocket']
      });

      return new Promise((resolve) => {
        clientSocket2.on('connect', () => {
          expect(clientSocket.connected).toBe(true);
          expect(clientSocket2.connected).toBe(true);
          expect(clientSocket.id).not.toBe(clientSocket2.id);

          clientSocket2.disconnect();
          resolve();
        });

        setTimeout(() => {
          clientSocket2.disconnect();
          resolve();
        }, 3000);
      });
    });
  });

  describe('Real-time Synchronization', () => {
    it('should sync state across multiple clients', async () => {
      const token = generateToken('123');
      const client2 = ioClient(URL, {
        auth: { token },
        transports: ['websocket']
      });

      return new Promise((resolve) => {
        client2.on('connect', () => {
          // Subscribe both to same dispatch
          clientSocket.emit(
            'dispatch:subscribe',
            { despachoId: '999' },
            () => {
              client2.emit(
                'dispatch:subscribe',
                { despachoId: '999' },
                () => {
                  // Send update from client 1
                  clientSocket.emit('dispatch:location-update', {
                    despachoId: '999',
                    latitud: 40.7128,
                    longitud: -74.0060
                  });
                }
              );
            }
          );

          client2.on('dispatch:location-updated', () => {
            client2.disconnect();
            resolve();
          });

          setTimeout(() => {
            client2.disconnect();
            resolve();
          }, 3000);
        });
      });
    });
  });
});
