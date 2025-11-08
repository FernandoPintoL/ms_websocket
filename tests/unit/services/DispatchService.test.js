import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { DispatchService } from '../../../src/services/DispatchService.js';

describe('DispatchService', () => {
  let dispatchService;
  let mockAxios;
  let mockIO;
  let mockSocket;

  beforeEach(() => {
    mockAxios = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn()
    };

    mockSocket = {
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn()
    };

    mockIO = {
      to: jest.fn().mockReturnValue({
        emit: jest.fn()
      }),
      emit: jest.fn()
    };

    dispatchService = new DispatchService(
      mockAxios,
      mockIO,
      'http://ms-despacho'
    );
  });

  describe('getDespachos', () => {
    it('should retrieve all dispatches', async () => {
      const mockDespachos = [
        { id: '1', numero: 'D001', estado: 'ASIGNADO' },
        { id: '2', numero: 'D002', estado: 'EN_ROUTE' }
      ];

      mockAxios.get.mockResolvedValueOnce({
        data: { data: mockDespachos }
      });

      const result = await dispatchService.getDespachos({}, 'token123');

      expect(result).toEqual(mockDespachos);
      expect(mockAxios.get).toHaveBeenCalledWith(
        '/api/v1/despachos',
        expect.any(Object)
      );
    });

    it('should filter dispatches by estado', async () => {
      const mockDespachos = [
        { id: '1', numero: 'D001', estado: 'PENDIENTE' }
      ];

      mockAxios.get.mockResolvedValueOnce({
        data: { data: mockDespachos }
      });

      await dispatchService.getDespachos({ estado: 'PENDIENTE' }, 'token123');

      expect(mockAxios.get).toHaveBeenCalled();
    });

    it('should handle API errors', async () => {
      mockAxios.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        dispatchService.getDespachos({}, 'token123')
      ).rejects.toThrow('Network error');
    });
  });

  describe('getDespacho', () => {
    it('should retrieve a specific dispatch', async () => {
      const mockDespacho = {
        id: '1',
        numero: 'D001',
        estado: 'ASIGNADO',
        paciente: 'John Doe'
      };

      mockAxios.get.mockResolvedValueOnce({
        data: { data: mockDespacho }
      });

      const result = await dispatchService.getDespacho('1', 'token123');

      expect(result).toEqual(mockDespacho);
      expect(mockAxios.get).toHaveBeenCalledWith(
        '/api/v1/despachos/1',
        expect.any(Object)
      );
    });

    it('should throw error if dispatch not found', async () => {
      mockAxios.get.mockRejectedValueOnce(
        new Error('Dispatch not found')
      );

      await expect(
        dispatchService.getDespacho('999', 'token123')
      ).rejects.toThrow('Dispatch not found');
    });
  });

  describe('createDespacho', () => {
    it('should create a new dispatch', async () => {
      const newDispatch = {
        paciente: 'Jane Doe',
        latitud: 40.7128,
        longitud: -74.0060,
        notas: 'Urgent case'
      };

      const createdDispatch = {
        id: '123',
        numero: 'D003',
        ...newDispatch,
        estado: 'PENDIENTE'
      };

      mockAxios.post.mockResolvedValueOnce({
        data: { data: createdDispatch }
      });

      const result = await dispatchService.createDespacho(
        newDispatch,
        'token123'
      );

      expect(result).toEqual(createdDispatch);
      expect(mockAxios.post).toHaveBeenCalledWith(
        '/api/v1/despachos',
        newDispatch,
        expect.any(Object)
      );
    });

    it('should broadcast dispatch creation event', async () => {
      const newDispatch = {
        paciente: 'Jane Doe',
        latitud: 40.7128,
        longitud: -74.0060
      };

      const createdDispatch = { id: '123', ...newDispatch };

      mockAxios.post.mockResolvedValueOnce({
        data: { data: createdDispatch }
      });

      await dispatchService.createDespacho(newDispatch, 'token123');

      expect(mockIO.emit).toHaveBeenCalledWith(
        'dispatch:created',
        expect.any(Object)
      );
    });
  });

  describe('updateDespachoEstado', () => {
    it('should update dispatch status', async () => {
      const updatedDispatch = {
        id: '1',
        numero: 'D001',
        estado: 'EN_ROUTE'
      };

      mockAxios.put.mockResolvedValueOnce({
        data: { data: updatedDispatch }
      });

      const result = await dispatchService.updateDespachoEstado(
        '1',
        'EN_ROUTE',
        'token123'
      );

      expect(result).toEqual(updatedDispatch);
      expect(mockAxios.put).toHaveBeenCalled();
    });

    it('should broadcast status change event', async () => {
      const updatedDispatch = { id: '1', estado: 'COMPLETADO' };

      mockAxios.put.mockResolvedValueOnce({
        data: { data: updatedDispatch }
      });

      await dispatchService.updateDespachoEstado('1', 'COMPLETADO', 'token123');

      expect(mockIO.to).toHaveBeenCalled();
    });
  });

  describe('addRastreo', () => {
    it('should add location tracking', async () => {
      const location = {
        latitud: 40.7128,
        longitud: -74.0060,
        velocidad: 45
      };

      const rastreo = {
        id: 'R001',
        despachoId: '1',
        ...location,
        timestamp: new Date().toISOString()
      };

      mockAxios.post.mockResolvedValueOnce({
        data: { data: rastreo }
      });

      const result = await dispatchService.addRastreo('1', location, 'token123');

      expect(result).toEqual(rastreo);
      expect(mockAxios.post).toHaveBeenCalledWith(
        '/api/v1/despachos/1/rastreo',
        location,
        expect.any(Object)
      );
    });

    it('should validate location coordinates', async () => {
      const invalidLocation = {
        latitud: 95, // Invalid
        longitud: -74.0060
      };

      await expect(
        dispatchService.addRastreo('1', invalidLocation, 'token123')
      ).rejects.toThrow();
    });

    it('should broadcast location update', async () => {
      const location = {
        latitud: 40.7128,
        longitud: -74.0060
      };

      const rastreo = { id: 'R001', ...location };

      mockAxios.post.mockResolvedValueOnce({
        data: { data: rastreo }
      });

      await dispatchService.addRastreo('1', location, 'token123');

      expect(mockIO.to).toHaveBeenCalledWith('dispatch:1');
    });
  });

  describe('subscribeToDispatch', () => {
    it('should subscribe socket to dispatch room', () => {
      dispatchService.subscribeToDispatch('1', mockSocket);

      expect(mockSocket.join).toHaveBeenCalledWith('dispatch:1');
    });

    it('should handle multiple subscriptions', () => {
      const mockSocket2 = { join: jest.fn() };

      dispatchService.subscribeToDispatch('1', mockSocket);
      dispatchService.subscribeToDispatch('1', mockSocket2);

      expect(mockSocket.join).toHaveBeenCalledWith('dispatch:1');
      expect(mockSocket2.join).toHaveBeenCalledWith('dispatch:1');
    });
  });

  describe('unsubscribeFromDispatch', () => {
    it('should unsubscribe socket from dispatch room', () => {
      dispatchService.unsubscribeFromDispatch('1', mockSocket);

      expect(mockSocket.leave).toHaveBeenCalledWith('dispatch:1');
    });
  });

  describe('getRastreoHistoria', () => {
    it('should get location history for dispatch', async () => {
      const rastreoHistory = [
        {
          id: 'R001',
          despachoId: '1',
          latitud: 40.7128,
          longitud: -74.0060,
          timestamp: new Date().toISOString()
        }
      ];

      mockAxios.get.mockResolvedValueOnce({
        data: { data: rastreoHistory }
      });

      const result = await dispatchService.getRastreoHistoria('1', 'token123');

      expect(result).toEqual(rastreoHistory);
      expect(mockAxios.get).toHaveBeenCalledWith(
        '/api/v1/despachos/1/rastreo',
        expect.any(Object)
      );
    });
  });
});
