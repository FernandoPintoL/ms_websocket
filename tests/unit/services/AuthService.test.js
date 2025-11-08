import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { AuthService } from '../../../src/services/AuthService.js';

describe('AuthService', () => {
  let authService;
  let mockAxios;
  let mockRedisClient;

  beforeEach(() => {
    mockAxios = {
      post: jest.fn(),
      get: jest.fn()
    };

    mockRedisClient = {
      setEx: jest.fn(),
      get: jest.fn(),
      del: jest.fn()
    };

    authService = new AuthService(
      mockAxios,
      mockRedisClient,
      'http://ms-auth',
      'test-jwt-secret'
    );
  });

  describe('verifyToken', () => {
    it('should verify a valid JWT token', async () => {
      const token = jwt.sign(
        { id: '123', nombre: 'Test User', role: 'ADMIN' },
        'test-jwt-secret'
      );

      const result = await authService.verifyToken(token);

      expect(result).toBeDefined();
      expect(result.id).toBe('123');
      expect(result.nombre).toBe('Test User');
      expect(result.role).toBe('ADMIN');
    });

    it('should throw error for invalid JWT token', async () => {
      const invalidToken = 'invalid.token.here';

      await expect(authService.verifyToken(invalidToken)).rejects.toThrow();
    });

    it('should fall back to MS Auth for token validation', async () => {
      const externalToken = 'external-token';
      mockAxios.post.mockResolvedValueOnce({
        data: {
          validateToken: {
            usuario: { id: '456', nombre: 'External User' }
          }
        }
      });

      // Simulate invalid local JWT
      const result = await authService.verifyToken(externalToken);

      expect(mockAxios.post).toHaveBeenCalled();
    });

    it('should cache token verification', async () => {
      const token = jwt.sign(
        { id: '123', nombre: 'Test User' },
        'test-jwt-secret'
      );

      mockRedisClient.get.mockResolvedValueOnce(
        JSON.stringify({ id: '123', nombre: 'Test User' })
      );

      const result = await authService.verifyToken(token);

      expect(mockRedisClient.get).toHaveBeenCalled();
    });
  });

  describe('createLocalToken', () => {
    it('should create a valid JWT token', () => {
      const user = { id: '123', nombre: 'Test User', role: 'ADMIN' };

      const token = authService.createLocalToken(user);

      expect(token).toBeDefined();
      const decoded = jwt.verify(token, 'test-jwt-secret');
      expect(decoded.id).toBe('123');
      expect(decoded.nombre).toBe('Test User');
    });

    it('should include user data in token', () => {
      const user = {
        id: '789',
        nombre: 'John Doe',
        email: 'john@example.com',
        role: 'DISPATCHER'
      };

      const token = authService.createLocalToken(user);
      const decoded = jwt.verify(token, 'test-jwt-secret');

      expect(decoded.id).toBe('789');
      expect(decoded.nombre).toBe('John Doe');
      expect(decoded.email).toBe('john@example.com');
      expect(decoded.role).toBe('DISPATCHER');
    });
  });

  describe('hasPermission', () => {
    it('should return true if user has permission', () => {
      const user = {
        id: '123',
        permissions: ['dispatch:read', 'dispatch:write']
      };

      expect(authService.hasPermission(user, 'dispatch:write')).toBe(true);
    });

    it('should return false if user lacks permission', () => {
      const user = {
        id: '123',
        permissions: ['dispatch:read']
      };

      expect(authService.hasPermission(user, 'dispatch:delete')).toBe(false);
    });

    it('should handle undefined permissions array', () => {
      const user = { id: '123' };

      expect(authService.hasPermission(user, 'dispatch:read')).toBe(false);
    });
  });

  describe('hasRole', () => {
    it('should return true for matching role', () => {
      const user = { id: '123', role: 'ADMIN' };

      expect(authService.hasRole(user, 'ADMIN')).toBe(true);
    });

    it('should return false for non-matching role', () => {
      const user = { id: '123', role: 'DRIVER' };

      expect(authService.hasRole(user, 'ADMIN')).toBe(false);
    });

    it('should handle array of roles', () => {
      const user = { id: '123', role: 'DISPATCHER' };

      expect(authService.hasRole(user, ['ADMIN', 'DISPATCHER'])).toBe(true);
    });
  });

  describe('refreshToken', () => {
    it('should refresh an expired token', async () => {
      const oldToken = jwt.sign(
        { id: '123', nombre: 'Test' },
        'test-jwt-secret',
        { expiresIn: '-1s' } // Expired
      );

      mockAxios.post.mockResolvedValueOnce({
        data: {
          refreshToken: {
            token: jwt.sign(
              { id: '123', nombre: 'Test' },
              'test-jwt-secret'
            )
          }
        }
      });

      const newToken = await authService.refreshToken(oldToken);

      expect(newToken).toBeDefined();
      expect(newToken).not.toBe(oldToken);
    });
  });

  describe('logout', () => {
    it('should invalidate token on logout', async () => {
      const token = jwt.sign({ id: '123' }, 'test-jwt-secret');

      mockAxios.post.mockResolvedValueOnce({ data: { success: true } });
      mockRedisClient.setEx.mockResolvedValueOnce('OK');

      const result = await authService.logout(token);

      expect(result).toBe(true);
      expect(mockRedisClient.setEx).toHaveBeenCalled();
    });
  });
});
