/**
 * Auth Service
 * Handles authentication and token verification
 * Communicates with MS Autentificacion
 */

import axios from 'axios';
import jwt from 'jsonwebtoken';
import { logger } from '../config/logger.js';

export class AuthService {
  constructor() {
    this.msAuthUrl = process.env.MS_AUTH_URL || 'http://localhost:8003';
    this.msAuthEndpoint = process.env.MS_AUTH_VERIFY_ENDPOINT || '/graphql';
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    this.timeout = parseInt(process.env.MS_AUTH_TIMEOUT || '10000');
    this.axiosInstance = axios.create({
      timeout: this.timeout,
      baseURL: this.msAuthUrl
    });
  }

  /**
   * Verify JWT token with MS Autentificacion
   * @param {string} token - JWT token from client
   * @returns {Promise<Object>} - User data if valid
   * @throws {Error} - If token is invalid
   */
  async verifyToken(token) {
    try {
      // First, verify locally if it's a JWT we issued
      try {
        const decoded = jwt.verify(token, this.jwtSecret);
        logger.debug({ userId: decoded.id }, 'Token verified locally');
        return decoded;
      } catch (localError) {
        logger.debug({ error: localError.message }, 'Local token verification failed, trying MS Auth');
      }

      // If local verification fails, verify with MS Autentificacion
      const response = await this.axiosInstance.post(this.msAuthEndpoint, {
        query: `
          query {
            validateToken(token: "${token}") {
              valid
              usuario {
                id
                nombre
                email
                rol
              }
              permisos
            }
          }
        `
      });

      const { data } = response;

      if (data.errors) {
        throw new Error(data.errors[0]?.message || 'Token validation failed');
      }

      const { validateToken } = data.data;

      if (!validateToken.valid) {
        throw new Error('Invalid token');
      }

      const user = {
        id: validateToken.usuario.id,
        name: validateToken.usuario.nombre,
        email: validateToken.usuario.email,
        role: validateToken.usuario.rol,
        permissions: validateToken.permisos
      };

      logger.info({ userId: user.id }, 'Token verified with MS Auth');
      return user;
    } catch (error) {
      logger.error({ error: error.message, token: token?.substring(0, 20) }, 'Token verification failed');
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }

  /**
   * Create local JWT token for WebSocket session
   * @param {Object} user - User data
   * @returns {string} - JWT token
   */
  createLocalToken(user) {
    try {
      const token = jwt.sign(
        {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          permissions: user.permissions
        },
        this.jwtSecret,
        {
          expiresIn: process.env.JWT_EXPIRATION || '24h',
          issuer: 'ms-websocket',
          audience: 'websocket-clients'
        }
      );

      logger.info({ userId: user.id }, 'Local token created');
      return token;
    } catch (error) {
      logger.error({ error }, 'Failed to create local token');
      throw error;
    }
  }

  /**
   * Verify permission for user
   * @param {Object} user - User data from token
   * @param {string} permission - Permission to check
   * @returns {boolean} - True if user has permission
   */
  hasPermission(user, permission) {
    if (!user?.permissions) {
      return false;
    }

    const hasPermission = user.permissions.includes(permission);
    logger.debug({
      userId: user.id,
      permission,
      hasPermission
    }, 'Permission check');

    return hasPermission;
  }

  /**
   * Verify user has specific role
   * @param {Object} user - User data
   * @param {string} role - Role to check
   * @returns {boolean} - True if user has role
   */
  hasRole(user, role) {
    const hasRole = user?.role === role;
    logger.debug({
      userId: user.id,
      role,
      hasRole
    }, 'Role check');

    return hasRole;
  }

  /**
   * Check if user has any of the specified roles
   * @param {Object} user - User data
   * @param {string[]} roles - Array of roles
   * @returns {boolean} - True if user has any role
   */
  hasAnyRole(user, roles) {
    const hasRole = roles.includes(user?.role);
    logger.debug({
      userId: user.id,
      roles,
      hasRole
    }, 'Role check (any)');

    return hasRole;
  }

  /**
   * Refresh token with MS Autentificacion
   * @param {string} token - Current token
   * @returns {Promise<string>} - New token
   */
  async refreshToken(token) {
    try {
      const response = await this.axiosInstance.post(this.msAuthEndpoint, {
        query: `
          mutation {
            refreshToken(token: "${token}") {
              token
              expiresIn
            }
          }
        `
      });

      const { data } = response;

      if (data.errors) {
        throw new Error(data.errors[0]?.message || 'Token refresh failed');
      }

      const newToken = data.data.refreshToken.token;
      logger.info('Token refreshed successfully');

      return newToken;
    } catch (error) {
      logger.error({ error: error.message }, 'Token refresh failed');
      throw error;
    }
  }

  /**
   * Logout user (invalidate token)
   * @param {string} token - Token to invalidate
   * @returns {Promise<boolean>}
   */
  async logout(token) {
    try {
      const response = await this.axiosInstance.post(this.msAuthEndpoint, {
        query: `
          mutation {
            logout
          }
        `,
        context: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      });

      const { data } = response;

      if (data.errors) {
        throw new Error(data.errors[0]?.message || 'Logout failed');
      }

      logger.info('User logged out');
      return true;
    } catch (error) {
      logger.error({ error: error.message }, 'Logout failed');
      throw error;
    }
  }
}

export default AuthService;
