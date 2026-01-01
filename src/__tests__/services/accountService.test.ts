/**
 * Tests for AccountService
 * 
 * Tests account method calls through the worklet
 */

import { AccountService } from '../../services/accountService'
import { getWorkletStore } from '../../store/workletStore'

// Mock stores
jest.mock('../../store/workletStore', () => ({
  getWorkletStore: jest.fn(),
}))

describe('AccountService', () => {
  let mockWorkletStore: any
  let mockHRPC: any

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup mock HRPC
    mockHRPC = {
      callMethod: jest.fn(),
    }

    // Setup mock worklet store
    mockWorkletStore = {
      getState: jest.fn(() => ({
        isInitialized: true,
        hrpc: mockHRPC,
      })),
    }

    // Setup store mocks
    ;(getWorkletStore as jest.Mock).mockReturnValue(mockWorkletStore)
  })

  describe('callAccountMethod', () => {
    it('should call method and return result', async () => {
      const mockResult = { balance: '1000000000000000000' }
      mockHRPC.callMethod.mockResolvedValue({
        result: JSON.stringify(mockResult),
      })

      const result = await AccountService.callAccountMethod(
        'ethereum',
        0,
        'getBalance'
      )

      expect(result).toEqual(mockResult)
      expect(mockHRPC.callMethod).toHaveBeenCalledWith({
        methodName: 'getBalance',
        network: 'ethereum',
        accountIndex: 0,
        args: null,
      })
    })

    it('should handle method with arguments', async () => {
      const mockArgs = { message: 'Hello World' }
      const mockResult = { signature: '0x123' }
      mockHRPC.callMethod.mockResolvedValue({
        result: JSON.stringify(mockResult),
      })

      const result = await AccountService.callAccountMethod(
        'ethereum',
        0,
        'signMessage',
        mockArgs
      )

      expect(result).toEqual(mockResult)
      expect(mockHRPC.callMethod).toHaveBeenCalledWith({
        methodName: 'signMessage',
        network: 'ethereum',
        accountIndex: 0,
        args: JSON.stringify(mockArgs),
      })
    })

    it('should convert BigInt values to strings', async () => {
      const mockResult = {
        balance: BigInt('1000000000000000000'),
        amount: BigInt('2000000000000000000'),
        name: 'test',
      }
      const jsonString = JSON.stringify(
        mockResult,
        (_, value) => (typeof value === 'bigint' ? value.toString() : value)
      )
      mockHRPC.callMethod.mockResolvedValue({
        result: jsonString,
      })

      const result = await AccountService.callAccountMethod(
        'ethereum',
        0,
        'getBalance'
      )

      expect(result).toEqual({
        balance: '1000000000000000000',
        amount: '2000000000000000000',
        name: 'test',
      })
    })

    it('should convert BigInt in nested objects', async () => {
      const mockResult = {
        data: {
          balance: BigInt('1000000000000000000'),
          nested: {
            amount: BigInt('2000000000000000000'),
          },
        },
      }
      const jsonString = JSON.stringify(
        mockResult,
        (_, value) => (typeof value === 'bigint' ? value.toString() : value)
      )
      mockHRPC.callMethod.mockResolvedValue({
        result: jsonString,
      })

      const result = await AccountService.callAccountMethod(
        'ethereum',
        0,
        'getBalance'
      )

      expect(result).toEqual({
        data: {
          balance: '1000000000000000000',
          nested: {
            amount: '2000000000000000000',
          },
        },
      })
    })

    it('should convert BigInt in arrays', async () => {
      const mockResult = {
        balances: ['1000000000000000000', '2000000000000000000'],
      }
      // Simulate BigInt in response by using a custom replacer
      const jsonString = JSON.stringify(
        {
          balances: [BigInt('1000000000000000000'), BigInt('2000000000000000000')],
        },
        (_, value) => (typeof value === 'bigint' ? value.toString() : value)
      )
      mockHRPC.callMethod.mockResolvedValue({
        result: jsonString,
      })

      const result = await AccountService.callAccountMethod(
        'ethereum',
        0,
        'getBalances'
      )

      expect(result).toEqual({
        balances: ['1000000000000000000', '2000000000000000000'],
      })
    })

    it('should validate methodName', async () => {
      await expect(
        AccountService.callAccountMethod('ethereum', 0, '', null)
      ).rejects.toThrow('methodName must be a non-empty string')

      await expect(
        AccountService.callAccountMethod('ethereum', 0, '   ', null)
      ).rejects.toThrow('methodName must be a non-empty string')
    })

    it('should validate network name', async () => {
      await expect(
        AccountService.callAccountMethod('', 0, 'getBalance', null)
      ).rejects.toThrow('network must be a non-empty string')
    })

    it('should validate account index', async () => {
      await expect(
        AccountService.callAccountMethod('ethereum', -1, 'getBalance', null)
      ).rejects.toThrow('accountIndex must be a non-negative integer')
    })

    it('should throw error if WDK not initialized', async () => {
      mockWorkletStore.getState = jest.fn(() => ({
        isInitialized: false,
        hrpc: null,
      }))

      await expect(
        AccountService.callAccountMethod('ethereum', 0, 'getBalance', null)
      ).rejects.toThrow('WDK not initialized')
    })

    it('should throw error if HRPC not available', async () => {
      mockWorkletStore.getState = jest.fn(() => ({
        isInitialized: true,
        hrpc: null,
      }))

      await expect(
        AccountService.callAccountMethod('ethereum', 0, 'getBalance', null)
      ).rejects.toThrow('WDK not initialized')
    })

    it('should throw error if method returns no result', async () => {
      mockHRPC.callMethod.mockResolvedValue({
        result: null,
      })

      await expect(
        AccountService.callAccountMethod('ethereum', 0, 'getBalance', null)
      ).rejects.toThrow('Method getBalance returned no result')
    })

    it('should throw error if result is null', async () => {
      mockHRPC.callMethod.mockResolvedValue({
        result: JSON.stringify(null),
      })

      await expect(
        AccountService.callAccountMethod('ethereum', 0, 'getBalance', null)
      ).rejects.toThrow('Parsed result is null or undefined')
    })

    it('should throw error if result is null', async () => {
      mockHRPC.callMethod.mockResolvedValue({
        result: JSON.stringify(null),
      })

      await expect(
        AccountService.callAccountMethod('ethereum', 0, 'getBalance', null)
      ).rejects.toThrow('Parsed result is null or undefined')
    })

    it('should throw error if JSON parsing fails', async () => {
      mockHRPC.callMethod.mockResolvedValue({
        result: 'invalid json',
      })

      await expect(
        AccountService.callAccountMethod('ethereum', 0, 'getBalance', null)
      ).rejects.toThrow('Failed to parse result from getBalance')
    })

    it('should handle worklet call errors', async () => {
      mockHRPC.callMethod.mockRejectedValue(new Error('Worklet error'))

      await expect(
        AccountService.callAccountMethod('ethereum', 0, 'getBalance', null)
      ).rejects.toThrow()
    })
  })
})

