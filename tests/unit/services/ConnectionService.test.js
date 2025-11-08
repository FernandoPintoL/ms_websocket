import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ConnectionService } from '../../../src/services/ConnectionService.js';

describe('ConnectionService', () => {
  let connectionService;
  let mockConnectionRepository;
  let mockIO;

  beforeEach(() => {
    mockConnectionRepository = {
      saveConnection: jest.fn(),
      getConnection: jest.fn(),
      removeConnection: jest.fn(),
      getUserConnections: jest.fn(),
      getConnectionCount: jest.fn(),
      connectionExists: jest.fn(),
      updateConnectionMetadata: jest.fn()
    };

    mockIO = {
      to: jest.fn().mockReturnValue({
        emit: jest.fn()
      }),
      emit: jest.fn()
    };

    connectionService = new ConnectionService(
      mockConnectionRepository,
      mockIO
    );
  });

  describe('recordConnection', () => {
    it('should record a new connection', async () => {
      const mockSocket = {
        id: 'socket-123',
        handshake: {
          address: '192.168.1.1',
          headers: { 'user-agent': 'Mozilla/5.0' }
        }
      };

      const userId = 'user-456';

      mockConnectionRepository.saveConnection.mockResolvedValueOnce({
        socketId: 'socket-123',
        userId: 'user-456'
      });

      const result = await connectionService.recordConnection(
        mockSocket,
        userId
      );

      expect(result).toBeDefined();
      expect(mockConnectionRepository.saveConnection).toHaveBeenCalled();
    });

    it('should capture connection metadata', async () => {
      const mockSocket = {
        id: 'socket-789',
        handshake: {
          address: '10.0.0.1',
          headers: { 'user-agent': 'Firefox' }
        }
      };

      mockConnectionRepository.saveConnection.mockResolvedValueOnce({
        socketId: 'socket-789',
        userId: 'user-789',
        ip: '10.0.0.1'
      });

      await connectionService.recordConnection(mockSocket, 'user-789');

      expect(mockConnectionRepository.saveConnection).toHaveBeenCalledWith(
        'socket-789',
        'user-789',
        expect.objectContaining({
          ip: '192.168.1.1'
        })
      );
    });
  });

  describe('removeConnection', () => {
    it('should remove a connection', async () => {
      mockConnectionRepository.removeConnection.mockResolvedValueOnce(true);

      const result = await connectionService.removeConnection('socket-123');

      expect(result).toBe(true);
      expect(mockConnectionRepository.removeConnection).toHaveBeenCalledWith(
        'socket-123'
      );
    });

    it('should handle non-existent connections', async () => {
      mockConnectionRepository.removeConnection.mockResolvedValueOnce(false);

      const result = await connectionService.removeConnection('non-existent');

      expect(result).toBe(false);
    });

    it('should broadcast disconnection event', async () => {
      mockConnectionRepository.removeConnection.mockResolvedValueOnce(true);
      mockConnectionRepository.getConnection.mockResolvedValueOnce({
        userId: 'user-123'
      });

      await connectionService.removeConnection('socket-123');

      expect(mockIO.emit).toHaveBeenCalledWith(
        'user:disconnected',
        expect.any(Object)
      );
    });
  });

  describe('getUserConnections', () => {
    it('should get all connections for a user', async () => {
      const connections = [
        { socketId: 'socket-1', userId: 'user-123' },
        { socketId: 'socket-2', userId: 'user-123' }
      ];

      mockConnectionRepository.getUserConnections.mockResolvedValueOnce(
        connections
      );

      const result = await connectionService.getUserConnections('user-123');

      expect(result).toEqual(connections);
      expect(mockConnectionRepository.getUserConnections).toHaveBeenCalledWith(
        'user-123'
      );
    });

    it('should return empty array for user with no connections', async () => {
      mockConnectionRepository.getUserConnections.mockResolvedValueOnce([]);

      const result = await connectionService.getUserConnections('user-no-conn');

      expect(result).toEqual([]);
    });
  });

  describe('getConnectionCount', () => {
    it('should return total connection count', async () => {
      mockConnectionRepository.getConnectionCount.mockResolvedValueOnce(42);

      const result = await connectionService.getConnectionCount();

      expect(result).toBe(42);
    });

    it('should return 0 when no connections', async () => {
      mockConnectionRepository.getConnectionCount.mockResolvedValueOnce(0);

      const result = await connectionService.getConnectionCount();

      expect(result).toBe(0);
    });
  });

  describe('notifyUserConnections', () => {
    it('should notify all connections of a user', async () => {
      const connections = [
        { socketId: 'socket-1', userId: 'user-123' },
        { socketId: 'socket-2', userId: 'user-123' }
      ];

      mockConnectionRepository.getUserConnections.mockResolvedValueOnce(
        connections
      );

      const eventData = { status: 'online' };

      await connectionService.notifyUserConnections(
        'user-123',
        'user:status',
        eventData
      );

      expect(mockIO.to).toHaveBeenCalledWith('socket-1');
      expect(mockIO.to).toHaveBeenCalledWith('socket-2');
    });
  });

  describe('getConnection', () => {
    it('should get connection details', async () => {
      const connection = {
        socketId: 'socket-123',
        userId: 'user-123',
        connectedAt: new Date().toISOString()
      };

      mockConnectionRepository.getConnection.mockResolvedValueOnce(connection);

      const result = await connectionService.getConnection('socket-123');

      expect(result).toEqual(connection);
    });

    it('should return null for non-existent socket', async () => {
      mockConnectionRepository.getConnection.mockResolvedValueOnce(null);

      const result = await connectionService.getConnection('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('updateConnectionMetadata', () => {
    it('should update connection metadata', async () => {
      const updatedConnection = {
        socketId: 'socket-123',
        userId: 'user-123',
        status: 'active'
      };

      mockConnectionRepository.updateConnectionMetadata.mockResolvedValueOnce(
        updatedConnection
      );

      const result = await connectionService.updateConnectionMetadata(
        'socket-123',
        { status: 'active' }
      );

      expect(result).toEqual(updatedConnection);
    });
  });

  describe('isConnectionActive', () => {
    it('should check if connection is active', async () => {
      mockConnectionRepository.connectionExists.mockResolvedValueOnce(true);

      const result = await connectionService.isConnectionActive('socket-123');

      expect(result).toBe(true);
    });

    it('should return false for inactive connection', async () => {
      mockConnectionRepository.connectionExists.mockResolvedValueOnce(false);

      const result = await connectionService.isConnectionActive(
        'inactive-socket'
      );

      expect(result).toBe(false);
    });
  });
});
