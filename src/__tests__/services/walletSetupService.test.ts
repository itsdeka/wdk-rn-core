/**
 * Tests for WalletSetupService
 * 
 * Verifies proper handling of null returns from secure storage,
 * error messages, and wallet operations.
 */

// Mock React before importing services that use zustand
jest.mock('react', () => ({
  useSyncExternalStore: jest.fn((subscribe, getSnapshot) => getSnapshot()),
}), { virtual: true })

import { WalletSetupService } from '../../services/walletSetupService'
import type { SecureStorage } from '@tetherto/wdk-rn-secure-storage'
import type { NetworkConfigs } from '../../types'
import { WorkletService } from '../../services/workletService'

// Mock dependencies
jest.mock('../../services/workletService')
jest.mock('../../store/workletStore', () => ({
  getWorkletStore: jest.fn(() => ({
    getState: jest.fn(() => ({
      isWorkletStarted: true,
      isInitialized: false,
    })),
    setState: jest.fn(),
  })),
}))

const mockWorkletService = WorkletService as jest.Mocked<typeof WorkletService>

describe('WalletSetupService', () => {
  let mockSecureStorage: jest.Mocked<SecureStorage>

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockSecureStorage = {
      authenticate: jest.fn().mockResolvedValue(true),
      hasWallet: jest.fn().mockResolvedValue(false),
      getEncryptionKey: jest.fn().mockResolvedValue('test-encryption-key'),
      getEncryptedSeed: jest.fn().mockResolvedValue('test-encrypted-seed'),
      getEncryptedEntropy: jest.fn().mockResolvedValue('test-encrypted-entropy'),
      setEncryptionKey: jest.fn().mockResolvedValue(undefined),
      setEncryptedSeed: jest.fn().mockResolvedValue(undefined),
      setEncryptedEntropy: jest.fn().mockResolvedValue(undefined),
      deleteWallet: jest.fn().mockResolvedValue(undefined),
      isBiometricAvailable: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<SecureStorage>

    mockWorkletService.startWorklet = jest.fn().mockResolvedValue(undefined)
    mockWorkletService.generateEntropyAndEncrypt = jest.fn().mockResolvedValue({
      encryptionKey: 'new-encryption-key',
      encryptedSeedBuffer: 'new-encrypted-seed',
      encryptedEntropyBuffer: 'new-encrypted-entropy',
    })
    mockWorkletService.initializeWDK = jest.fn().mockResolvedValue(undefined)
  })

  describe('loadExistingWallet', () => {
    it('should load wallet successfully when data exists', async () => {
      const result = await WalletSetupService.loadExistingWallet(mockSecureStorage)

      expect(result.encryptionKey).toBe('test-encryption-key')
      expect(result.encryptedSeed).toBe('test-encrypted-seed')
      expect(mockSecureStorage.getEncryptionKey).toHaveBeenCalled()
      expect(mockSecureStorage.getEncryptedSeed).toHaveBeenCalled()
    })

    it('should throw error when encryptionKey is null', async () => {
      mockSecureStorage.getEncryptionKey.mockResolvedValue(null)

      await expect(
        WalletSetupService.loadExistingWallet(mockSecureStorage)
      ).rejects.toThrow('Encryption key not found')

      expect(mockSecureStorage.getEncryptedSeed).not.toHaveBeenCalled()
    })

    it('should throw error when encryptedSeed is null', async () => {
      mockSecureStorage.getEncryptedSeed.mockResolvedValue(null)

      await expect(
        WalletSetupService.loadExistingWallet(mockSecureStorage)
      ).rejects.toThrow('Encrypted seed not found')

      expect(mockSecureStorage.getEncryptionKey).toHaveBeenCalled()
    })

    it('should throw error when both are null', async () => {
      mockSecureStorage.getEncryptionKey.mockResolvedValue(null)
      mockSecureStorage.getEncryptedSeed.mockResolvedValue(null)

      await expect(
        WalletSetupService.loadExistingWallet(mockSecureStorage)
      ).rejects.toThrow('Encryption key not found')
    })

    it('should provide descriptive error messages', async () => {
      mockSecureStorage.getEncryptionKey.mockResolvedValue(null)

      try {
        await WalletSetupService.loadExistingWallet(mockSecureStorage)
        fail('Should have thrown an error')
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        const errorMessage = (error as Error).message
        expect(errorMessage).toContain('Encryption key not found')
        expect(errorMessage).toContain('Authentication may have failed')
        expect(errorMessage).toContain('wallet does not exist')
      }
    })
  })

  describe('createNewWallet', () => {
    const networkConfigs: NetworkConfigs = {
      ethereum: {
        chainId: 1,
        blockchain: 'ethereum',
      },
    }

    it('should create wallet successfully', async () => {
      const result = await WalletSetupService.createNewWallet(
        mockSecureStorage,
        networkConfigs
      )

      expect(result.encryptionKey).toBe('new-encryption-key')
      expect(result.encryptedSeed).toBe('new-encrypted-seed')
      expect(mockSecureStorage.authenticate).toHaveBeenCalled()
      expect(mockSecureStorage.setEncryptionKey).toHaveBeenCalledWith('new-encryption-key')
      expect(mockSecureStorage.setEncryptedSeed).toHaveBeenCalledWith('new-encrypted-seed')
      expect(mockSecureStorage.setEncryptedEntropy).toHaveBeenCalledWith('new-encrypted-entropy')
    })

    it('should throw error when authentication fails', async () => {
      mockSecureStorage.authenticate.mockResolvedValue(false)

      await expect(
        WalletSetupService.createNewWallet(mockSecureStorage, networkConfigs)
      ).rejects.toThrow('Biometric authentication required')

      expect(mockSecureStorage.setEncryptionKey).not.toHaveBeenCalled()
    })
  })

  describe('hasWallet', () => {
    it('should return true when wallet exists', async () => {
      mockSecureStorage.hasWallet.mockResolvedValue(true)

      const result = await WalletSetupService.hasWallet(mockSecureStorage)

      expect(result).toBe(true)
      expect(mockSecureStorage.hasWallet).toHaveBeenCalled()
    })

    it('should return false when wallet does not exist', async () => {
      mockSecureStorage.hasWallet.mockResolvedValue(false)

      const result = await WalletSetupService.hasWallet(mockSecureStorage)

      expect(result).toBe(false)
    })
  })
})

