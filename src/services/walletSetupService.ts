import type { SecureStorage } from '@tetherto/wdk-rn-secure-storage'
import { createSecureStorage } from '@tetherto/wdk-rn-secure-storage'
import type { NetworkConfigs } from '../types'
import { getWorkletStore } from '../store/workletStore'
import { WorkletLifecycleService } from './workletLifecycleService'
import { DEFAULT_MNEMONIC_WORD_COUNT } from '../utils/constants'
import { log } from '../utils/logger'

/**
 * Cached credentials interface
 */
interface CachedCredentials {
  encryptionKey?: string
  encryptedSeed?: string
  encryptedEntropy?: string
}

/**
 * Wallet setup service
 * Handles creating new wallets and loading existing wallets with biometric authentication
 * Caches credentials in ephemeral memory to avoid repeated biometric prompts
 */
export class WalletSetupService {
  /**
   * Internal cache for credentials (ephemeral memory only)
   * Keyed by identifier for multi-wallet support
   */
  private static credentialsCache = new Map<string, CachedCredentials>()

  /**
   * Get cache key for identifier
   */
  private static getCacheKey(identifier?: string): string {
    return identifier || 'default'
  }

  /**
   * Cache credentials after retrieval
   */
  private static cacheCredentials(
    identifier: string | undefined,
    encryptionKey?: string,
    encryptedSeed?: string,
    encryptedEntropy?: string
  ): void {
    const cacheKey = this.getCacheKey(identifier)
    const existing = this.credentialsCache.get(cacheKey) || {}
    
    this.credentialsCache.set(cacheKey, {
      ...existing,
      ...(encryptionKey && { encryptionKey }),
      ...(encryptedSeed && { encryptedSeed }),
      ...(encryptedEntropy && { encryptedEntropy }),
    })
    
    log('✅ Credentials cached in memory', { hasIdentifier: !!identifier })
  }
  /**
   * Create a new wallet
   * Generates entropy, encrypts it, and stores credentials securely
   * Requires biometric authentication to ensure authorized wallet creation
   */
  static async createNewWallet(
    secureStorage: SecureStorage,
    networkConfigs: NetworkConfigs,
    identifier?: string
  ): Promise<{
    encryptionKey: string
    encryptedSeed: string
  }> {
    const store = getWorkletStore()

    // Step 1: Require biometric authentication before creating wallet
    log('🔐 Creating new wallet - biometric authentication required...')
    const authenticated = await secureStorage.authenticate()
    if (!authenticated) {
      throw new Error('Biometric authentication required to create wallet')
    }

    // Step 2: Start worklet
    if (!store.getState().isWorkletStarted) {
      await WorkletLifecycleService.startWorklet(networkConfigs)
    }

    // Step 3: Generate entropy and encrypt
    const result = await WorkletLifecycleService.generateEntropyAndEncrypt(DEFAULT_MNEMONIC_WORD_COUNT)

    // Step 4: Store credentials securely with identifier for multi-wallet support
    await secureStorage.setEncryptionKey(result.encryptionKey, identifier)
    await secureStorage.setEncryptedSeed(result.encryptedSeedBuffer, identifier)
    await secureStorage.setEncryptedEntropy(result.encryptedEntropyBuffer, identifier)

    // Cache credentials in memory
    this.cacheCredentials(
      identifier,
      result.encryptionKey,
      result.encryptedSeedBuffer,
      result.encryptedEntropyBuffer
    )

    log('✅ New wallet created and stored securely')
    
    return {
      encryptionKey: result.encryptionKey,
      encryptedSeed: result.encryptedSeedBuffer,
    }
  }

  /**
   * Load existing wallet from secure storage
   * Checks cache first, only requires biometric authentication if not cached
   */
  static async loadExistingWallet(
    secureStorage: SecureStorage,
    identifier?: string
  ): Promise<{
    encryptionKey: string
    encryptedSeed: string
  }> {
    const cacheKey = this.getCacheKey(identifier)
    const cached = this.credentialsCache.get(cacheKey)

    // Check if all required credentials are cached
    if (cached?.encryptionKey && cached?.encryptedSeed) {
      log('✅ Wallet loaded from cache (no biometrics needed)')
      return {
        encryptionKey: cached.encryptionKey,
        encryptedSeed: cached.encryptedSeed,
      }
    }

    log('🔓 Loading existing wallet - biometric authentication required...')
    
    // Get encrypted seed first (doesn't require biometrics)
    const encryptedSeed = await secureStorage.getEncryptedSeed(identifier)
    
    // Try to get encryption key from cache first
    let encryptionKey = cached?.encryptionKey
    
    // If not in cache, get from secureStorage (will trigger biometrics)
    if (!encryptionKey) {
      log('Encryption key not in cache, fetching from secureStorage...')
      const allEncrypted = await secureStorage.getAllEncrypted(identifier)
      encryptionKey = allEncrypted.encryptionKey || undefined
    } else {
      log('Using cached encryption key (no biometrics needed)')
    }

    if (!encryptionKey) {
      throw new Error('Encryption key not found. Authentication may have failed or wallet does not exist.')
    }

    if (!encryptedSeed) {
      throw new Error('Encrypted seed not found. Authentication may have failed or wallet does not exist.')
    }

    // Cache credentials for future use
    this.cacheCredentials(identifier, encryptionKey, encryptedSeed)

    log('✅ Wallet loaded successfully from secure storage')
    return {
      encryptionKey,
      encryptedSeed,
    }
  }

  /**
   * Check if a wallet exists
   */
  static async hasWallet(secureStorage: SecureStorage, identifier?: string): Promise<boolean> {
    return secureStorage.hasWallet(identifier)
  }

  /**
   * Initialize WDK from an existing mnemonic phrase
   * Converts mnemonic to encrypted seed and entropy, stores them securely, and initializes WDK
   * Requires biometric authentication to ensure authorized wallet import
   */
  static async initializeFromMnemonic(
    secureStorage: SecureStorage,
    networkConfigs: NetworkConfigs,
    mnemonic: string,
    identifier?: string
  ): Promise<{
    encryptionKey: string
    encryptedSeed: string
    encryptedEntropy: string
  }> {
    const store = getWorkletStore()

    // Step 1: Require biometric authentication before importing wallet
    log('🔐 Importing wallet from mnemonic - biometric authentication required...')
    const authenticated = await secureStorage.authenticate()
    if (!authenticated) {
      throw new Error('Biometric authentication required to import wallet')
    }

    // Step 2: Start worklet
    if (!store.getState().isWorkletStarted) {
      await WorkletLifecycleService.startWorklet(networkConfigs)
    }

    // Step 3: Get seed and entropy from mnemonic
    const result = await WorkletLifecycleService.getSeedAndEntropyFromMnemonic(mnemonic)

    // Step 4: Store credentials securely with identifier for multi-wallet support
    await secureStorage.setEncryptionKey(result.encryptionKey, identifier)
    await secureStorage.setEncryptedSeed(result.encryptedSeedBuffer, identifier)
    await secureStorage.setEncryptedEntropy(result.encryptedEntropyBuffer, identifier)

    // Cache credentials in memory
    this.cacheCredentials(
      identifier,
      result.encryptionKey,
      result.encryptedSeedBuffer,
      result.encryptedEntropyBuffer
    )

    // Step 5: Initialize WDK with the credentials
    await WorkletLifecycleService.initializeWDK({
      encryptionKey: result.encryptionKey,
      encryptedSeed: result.encryptedSeedBuffer,
    })

    log('✅ Wallet imported from mnemonic and stored securely')
    
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
      log('Starting worklet...')
      await WorkletLifecycleService.startWorklet(networkConfigs)
      log('Worklet started')
    }

    // Initialize WDK
    await WorkletLifecycleService.initializeWDK(credentials)
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
      identifier?: string
    }
  ): Promise<void> {
    const store = getWorkletStore()

    // Check if already initialized
    if (store.getState().isInitialized) {
      log('Wallet already initialized')
      return
    }

    let credentials: { encryptionKey: string; encryptedSeed: string }

    if (options.createNew) {
      // Create new wallet
      log('Creating new wallet...')
      credentials = await this.createNewWallet(secureStorage, networkConfigs, options.identifier)
    } else {
      // Load existing wallet (requires biometric authentication)
      log('Loading existing wallet...')
      credentials = await this.loadExistingWallet(secureStorage, options.identifier)
    }

    // Initialize WDK with credentials
    await this.initializeWDK(networkConfigs, credentials)
  }

  /**
   * Delete wallet and clear all data
   * 
   * @param secureStorage - Optional secure storage instance. If not provided, a default instance is created.
   * @param identifier - Optional identifier for multi-wallet support. If provided, deletes wallet for that identifier.
   *                    If not provided, deletes the default wallet.
   * 
   * NOTE: Since all SecureStorage instances access the same app-scoped storage,
   * any instance can be used for deletion.
   */
  static async deleteWallet(
    secureStorage?: SecureStorage,
    identifier?: string
  ): Promise<void> {
    // Use provided instance or create default (all instances access same storage)
    const storage = secureStorage || createSecureStorage()
    
    // Clear secure storage for the specified identifier
    await storage.deleteWallet(identifier)

    // Reset store state
    WorkletLifecycleService.reset()
    
    // Clear credentials cache
    this.clearCredentialsCache(identifier)
  }

  /**
   * Get encryption key (checks cache first, then secureStorage with biometrics)
   */
  static async getEncryptionKey(
    secureStorage: SecureStorage,
    identifier?: string
  ): Promise<string | null> {
    const cacheKey = this.getCacheKey(identifier)
    const cached = this.credentialsCache.get(cacheKey)

    if (cached?.encryptionKey) {
      log('✅ Encryption key retrieved from cache (no biometrics needed)')
      return cached.encryptionKey
    }

    log('Encryption key not in cache, fetching from secureStorage...')
    const allEncrypted = await secureStorage.getAllEncrypted(identifier)
    const encryptionKey = allEncrypted.encryptionKey || null

    if (encryptionKey) {
      // Cache it for future use
      this.cacheCredentials(identifier, encryptionKey)
    }

    return encryptionKey
  }

  /**
   * Get encrypted seed (checks cache first, then secureStorage)
   */
  static async getEncryptedSeed(
    secureStorage: SecureStorage,
    identifier?: string
  ): Promise<string | null> {
    const cacheKey = this.getCacheKey(identifier)
    const cached = this.credentialsCache.get(cacheKey)

    if (cached?.encryptedSeed) {
      log('✅ Encrypted seed retrieved from cache')
      return cached.encryptedSeed
    }

    const encryptedSeed = await secureStorage.getEncryptedSeed(identifier)

    if (encryptedSeed) {
      // Cache it for future use
      this.cacheCredentials(identifier, undefined, encryptedSeed)
    }

    return encryptedSeed || null
  }

  /**
   * Get encrypted entropy (checks cache first, then secureStorage)
   */
  static async getEncryptedEntropy(
    secureStorage: SecureStorage,
    identifier?: string
  ): Promise<string | null> {
    const cacheKey = this.getCacheKey(identifier)
    const cached = this.credentialsCache.get(cacheKey)

    if (cached?.encryptedEntropy) {
      log('✅ Encrypted entropy retrieved from cache')
      return cached.encryptedEntropy
    }

    const encryptedEntropy = await secureStorage.getEncryptedEntropy(identifier)

    if (encryptedEntropy) {
      // Cache it for future use
      this.cacheCredentials(identifier, undefined, undefined, encryptedEntropy)
    }

    return encryptedEntropy || null
  }

  /**
   * Get mnemonic phrase from wallet
   * Retrieves encrypted entropy and encryption key, then decrypts to get mnemonic
   * 
   * @param identifier - Optional identifier for multi-wallet support
   * @param secureStorage - Optional secure storage instance. If not provided, a default instance is created.
   * @returns Promise<string | null> - The mnemonic phrase or null if not found
   */
  static async getMnemonic(
    identifier?: string,
    secureStorage?: SecureStorage
  ): Promise<string | null> {
    // Use provided instance or create default (all instances access same storage)
    const storage = secureStorage || createSecureStorage()
    
    const encryptedEntropy = await this.getEncryptedEntropy(storage, identifier)
    const encryptionKey = await this.getEncryptionKey(storage, identifier)

    if (!encryptedEntropy || !encryptionKey) {
      return null
    }

    const result = await WorkletLifecycleService.getMnemonicFromEntropy(
      encryptedEntropy,
      encryptionKey
    )
    
    return result.mnemonic || null
  }

  /**
   * Clear all cached credentials
   * Should be called on logout or app background for security
   */
  static clearCredentialsCache(identifier?: string): void {
    if (identifier) {
      const deleted = this.credentialsCache.delete(this.getCacheKey(identifier))
      if (deleted) {
        log('✅ Credentials cache cleared', { identifier })
      }
    } else {
      const count = this.credentialsCache.size
      this.credentialsCache.clear()
      log('✅ All credentials cache cleared', { clearedCount: count })
    }
  }
}

