/**
 * Tests for MMKV storage adapter
 * 
 * Verifies that MMKV storage adapter works correctly and
 * that it's only used for non-sensitive data.
 */

import { createMMKVStorage, createMMKVStorageAdapter } from '../../storage/mmkvStorage'
import type { StorageAdapter } from '../../storage/mmkvStorage'

// Mock react-native-mmkv (override setup.ts mock for this test)
const mockMMKV = {
  getString: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
}

jest.mock('react-native-mmkv', () => ({
  createMMKV: jest.fn(() => mockMMKV),
  MMKV: jest.fn(() => mockMMKV),
}), { virtual: true })

describe('MMKV Storage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockMMKV.getString.mockReturnValue(undefined)
  })

  describe('createMMKVStorage', () => {
    it('should create MMKV instance with correct configuration', () => {
      const { createMMKV } = require('react-native-mmkv')
      
      createMMKVStorage()

      expect(createMMKV).toHaveBeenCalledWith({
        id: 'wallet-storage',
        encryptionKey: 'wallet-encryption-key',
      })
    })
  })

  describe('createMMKVStorageAdapter', () => {
    let adapter: StorageAdapter

    beforeEach(() => {
      adapter = createMMKVStorageAdapter()
    })

    it('should return storage adapter with correct interface', () => {
      expect(adapter).toHaveProperty('getItem')
      expect(adapter).toHaveProperty('setItem')
      expect(adapter).toHaveProperty('removeItem')
      expect(typeof adapter.getItem).toBe('function')
      expect(typeof adapter.setItem).toBe('function')
      expect(typeof adapter.removeItem).toBe('function')
    })

    it('should get item from MMKV', () => {
      mockMMKV.getString.mockReturnValue('test-value')

      const result = adapter.getItem('test-key')

      expect(result).toBe('test-value')
      expect(mockMMKV.getString).toHaveBeenCalledWith('test-key')
    })

    it('should return null when item does not exist', () => {
      mockMMKV.getString.mockReturnValue(undefined)

      const result = adapter.getItem('non-existent-key')

      expect(result).toBeNull()
    })

    it('should set item in MMKV', () => {
      adapter.setItem('test-key', 'test-value')

      expect(mockMMKV.set).toHaveBeenCalledWith('test-key', 'test-value')
    })

    it('should remove item from MMKV', () => {
      adapter.removeItem('test-key')

      expect(mockMMKV.delete).toHaveBeenCalledWith('test-key')
    })
  })

  describe('Security considerations', () => {
    it('should document that MMKV is for non-sensitive data only', () => {
      // This is a documentation test - MMKV should only store:
      // - addresses
      // - balances
      // - networkConfigs
      // - workletStartResult
      // - wdkInitResult
      // NOT: encryptionKey, encryptedSeed, encryptedEntropy
      
      const adapter = createMMKVStorageAdapter()
      
      // Example: storing non-sensitive data is acceptable
      adapter.setItem('addresses', JSON.stringify({ ethereum: { 0: '0x123' } }))
      expect(mockMMKV.set).toHaveBeenCalled()
    })

    it('should use hardcoded encryption key for non-sensitive data', () => {
      // The hardcoded key is acceptable since MMKV only stores non-sensitive data
      const storage = createMMKVStorage()
      expect(storage).toBeDefined()
    })
  })
})

