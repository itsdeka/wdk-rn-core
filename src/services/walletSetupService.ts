import type { SecureStorage } from '@tetherto/wdk-rn-secure-storage'
import { createSecureStorage } from '@tetherto/wdk-rn-secure-storage'
import type { NetworkConfigs } from '../types'
import { getWorkletStore } from '../store/workletStore'
import { WorkletService } from './workletService'

/**
 * Wallet setup service
 * Handles creating new wallets and loading existing wallets with biometric authentication
 */
export class WalletSetupService {
  /**
   * Create a new wallet
   * Generates entropy, encrypts it, and stores credentials securely
   * Requires biometric authentication to ensure authorized wallet creation
   */
  static async createNewWallet(
    secureStorage: SecureStorage,
    networkConfigs: NetworkConfigs
  ): Promise<{
    encryptionKey: string
    encryptedSeed: string
  }> {
    const store = getWorkletStore()

    // Step 1: Require biometric authentication before creating wallet
    console.log('🔐 Creating new wallet - biometric authentication required...')
    const authenticated = await secureStorage.authenticate()
    if (!authenticated) {
      throw new Error('Biometric authentication required to create wallet')
    }

    // Step 2: Start worklet
    if (!store.getState().isWorkletStarted) {
      await WorkletService.startWorklet(networkConfigs)
    }

    // Step 3: Generate entropy and encrypt
    const result = await WorkletService.generateEntropyAndEncrypt(12)

    // Step 4: Store credentials securely
    await secureStorage.setEncryptionKey(result.encryptionKey)
    await secureStorage.setEncryptedSeed(result.encryptedSeedBuffer)
    await secureStorage.setEncryptedEntropy(result.encryptedEntropyBuffer)

    console.log('✅ New wallet created and stored securely')
    return {
      encryptionKey: result.encryptionKey,
      encryptedSeed: result.encryptedSeedBuffer,
    }
  }

  /**
   * Load existing wallet from secure storage
   * Requires biometric authentication to access encryption key
   */
  static async loadExistingWallet(
    secureStorage: SecureStorage
  ): Promise<{
    encryptionKey: string
    encryptedSeed: string
  }> {
    console.log('🔓 Loading existing wallet - biometric authentication required...')
    
    const encryptionKey = await secureStorage.getEncryptionKey()
    const encryptedSeed = await secureStorage.getEncryptedSeed()

    if (!encryptionKey || !encryptedSeed) {
      throw new Error('Authentication failed')
    }

    console.log('✅ Wallet loaded successfully from secure storage')
    return {
      encryptionKey,
      encryptedSeed,
    }
  }

  /**
   * Check if a wallet exists
   */
  static async hasWallet(secureStorage: SecureStorage): Promise<boolean> {
    return secureStorage.hasWallet()
  }

  /**
   * Initialize WDK from an existing mnemonic phrase
   * Converts mnemonic to encrypted seed and entropy, stores them securely, and initializes WDK
   * Requires biometric authentication to ensure authorized wallet import
   */
  static async initializeFromMnemonic(
    secureStorage: SecureStorage,
    networkConfigs: NetworkConfigs,
    mnemonic: string
  ): Promise<{
    encryptionKey: string
    encryptedSeed: string
    encryptedEntropy: string
  }> {
    const store = getWorkletStore()

    // Step 1: Require biometric authentication before importing wallet
    console.log('🔐 Importing wallet from mnemonic - biometric authentication required...')
    const authenticated = await secureStorage.authenticate()
    if (!authenticated) {
      throw new Error('Biometric authentication required to import wallet')
    }

    // Step 2: Start worklet
    if (!store.getState().isWorkletStarted) {
      await WorkletService.startWorklet(networkConfigs)
    }

    // Step 3: Get seed and entropy from mnemonic
    const result = await WorkletService.getSeedAndEntropyFromMnemonic(mnemonic)

    // Step 4: Store credentials securely
    await secureStorage.setEncryptionKey(result.encryptionKey)
    await secureStorage.setEncryptedSeed(result.encryptedSeedBuffer)
    await secureStorage.setEncryptedEntropy(result.encryptedEntropyBuffer)

    // Step 5: Initialize WDK with the credentials
    await WorkletService.initializeWDK({
      encryptionKey: result.encryptionKey,
      encryptedSeed: result.encryptedSeedBuffer,
    })

    console.log('✅ Wallet imported from mnemonic and stored securely')
    return {
      encryptionKey: result.encryptionKey,
      encryptedSeed: result.encryptedSeedBuffer,
      encryptedEntropy: result.encryptedEntropyBuffer,
    }
  }

  /**
   * Initialize WDK with wallet credentials
   */
  static async initializeWDK(
    networkConfigs: NetworkConfigs,
    credentials: {
      encryptionKey: string
      encryptedSeed: string
    }
  ): Promise<void> {
    const store = getWorkletStore()

    // Ensure worklet is started
    if (!store.getState().isWorkletStarted) {
      console.log('Starting worklet...')
      await WorkletService.startWorklet(networkConfigs)
      console.log('Worklet started')
    }

    // Initialize WDK
    await WorkletService.initializeWDK(credentials)
  }

  /**
   * Complete wallet initialization flow
   * Either creates a new wallet or loads an existing one
   */
  static async initializeWallet(
    secureStorage: SecureStorage,
    networkConfigs: NetworkConfigs,
    options: {
      createNew?: boolean
    }
  ): Promise<void> {
    const store = getWorkletStore()

    // Check if already initialized
    if (store.getState().isInitialized) {
      console.log('Wallet already initialized')
      return
    }

    let credentials: { encryptionKey: string; encryptedSeed: string }

    if (options.createNew) {
      // Create new wallet
      console.log('Creating new wallet...')
      credentials = await this.createNewWallet(secureStorage, networkConfigs)
    } else {
      // Load existing wallet (requires biometric authentication)
      console.log('Loading existing wallet...')
      credentials = await this.loadExistingWallet(secureStorage)
    }

    // Initialize WDK with credentials
    await this.initializeWDK(networkConfigs, credentials)
  }

  /**
   * Delete wallet and clear all data
   * 
   * NOTE: secureStorage parameter is optional. If not provided, a default instance
   * is created. Since all SecureStorage instances access the same app-scoped storage,
   * any instance can be used for deletion.
   */
  static async deleteWallet(
    secureStorage?: SecureStorage
  ): Promise<void> {
    // Use provided instance or create default (all instances access same storage)
    const storage = secureStorage || createSecureStorage()
    
    // Clear secure storage
    await storage.deleteWallet()

    // Reset store state
    WorkletService.reset()
  }
}

