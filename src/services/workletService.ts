/**
 * Worklet Service
 * 
 * Handles all worklet operations and lifecycle management.
 * Updates the worklet store state as operations complete.
 */

// External packages
import { Worklet } from 'react-native-bare-kit'
import { HRPC } from 'pear-wrk-wdk'

// Local imports
import type { NetworkConfigs } from '../types'
import { getWorkletStore } from '../store/workletStore'
import { getWalletStore } from '../store/walletStore'

/**
 * Worklet Service
 * 
 * Provides static methods for worklet operations.
 * All methods update the worklet store state.
 */
export class WorkletService {
  static async startWorklet(
    networkConfigs: NetworkConfigs
  ): Promise<void> {
    const store = getWorkletStore()
    const state = store.getState()
    
    if (state.isLoading) {
      console.warn('Worklet initialization already in progress')
      return
    }

    if (state.isWorkletStarted) {
      console.log('Worklet already started')
      return
    }

    try {
      store.setState({ 
        error: null, 
        isLoading: true,
      })

      const { worklet: existingWorklet } = store.getState()
      if (existingWorklet) {
        // Add cleanup logic here if worklet has a cleanup method
        // existingWorklet.cleanup?.()
      }

      const worklet = new Worklet()

      // Dynamic import of pear-wrk-wdk bundle
      const pearWrkWdk = await import('pear-wrk-wdk')
      const bundle = (pearWrkWdk as { bundle?: unknown }).bundle

      if (!bundle) {
        throw new Error('Failed to load pear-wrk-wdk bundle')
      }

      // Bundle file (mobile bundle for React Native) - worklet.start expects bundle parameter
      ;(worklet.start as (path: string, bundle: unknown) => void)('/wdk-worklet.bundle', bundle)

      const { IPC } = worklet

      if (!IPC) {
        throw new Error('IPC not available from worklet')
      }

      const hrpcInstance = new HRPC(IPC)

      const result = await hrpcInstance.workletStart({
        config: JSON.stringify(networkConfigs),
      })

      store.setState({
        worklet,
        hrpc: hrpcInstance,
        ipc: IPC,
        isWorkletStarted: true,
        isLoading: false,
        networkConfigs,
        workletStartResult: result,
        error: null,
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      console.error('Failed to start worklet:', error)
      store.setState({
        error: errorMessage,
        isLoading: false,
        worklet: null,
        hrpc: null,
        ipc: null,
        isWorkletStarted: false,
      })
      throw error
    }
  }

  /**
   * Initialize WDK with encrypted seed (ONLY encrypted approach)
   */
  static async initializeWDK(
    options: { encryptionKey: string; encryptedSeed: string }
  ): Promise<void> {
    const store = getWorkletStore()
    const state = store.getState()
    
    if (!state.isWorkletStarted || !state.hrpc) {
      throw new Error('Worklet must be started before initializing WDK')
    }

    if (
      state.isInitialized &&
      state.encryptionKey === options.encryptionKey &&
      state.encryptedSeed === options.encryptedSeed
    ) {
      console.log('WDK already initialized with the same encrypted seed')
      return
    }

    try {
      store.setState({ 
        error: null, 
        isLoading: true,
      })

      const currentState = store.getState()
      if (!currentState.hrpc) {
        throw new Error('HRPC instance not available')
      }

      // initializeWDK exists on HRPC but may not be in types yet
      const result = await (currentState.hrpc as unknown as { initializeWDK: (options: { encryptionKey: string; encryptedSeed: string; config: string }) => Promise<unknown> }).initializeWDK({
        encryptionKey: options.encryptionKey,
        encryptedSeed: options.encryptedSeed,
        config: JSON.stringify(currentState.networkConfigs || {}),
      })

      // NEVER store seed phrase
      store.setState({
        isInitialized: true,
        isLoading: false,
        encryptedSeed: options.encryptedSeed,
        encryptionKey: options.encryptionKey,
        wdkInitResult: result,
        error: null,
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      console.error('Failed to initialize WDK:', error)
      store.setState({
        error: errorMessage,
        isLoading: false,
        isInitialized: false,
      })
      throw error
    }
  }

  /**
   * Generate entropy and encrypt (for creating new wallets)
   */
  static async generateEntropyAndEncrypt(
    wordCount: 12 | 24 = 12
  ): Promise<{
    encryptionKey: string
    encryptedSeedBuffer: string
    encryptedEntropyBuffer: string
  }> {
    const store = getWorkletStore()
    const state = store.getState()
    
    if (!state.isWorkletStarted || !state.hrpc) {
      throw new Error('Worklet must be started before generating entropy')
    }

    try {
      // generateEntropyAndEncrypt may not be in types yet
      const result = await (state.hrpc as unknown as { generateEntropyAndEncrypt: (options: { wordCount: number }) => Promise<{ encryptionKey: string; encryptedSeedBuffer: string; encryptedEntropyBuffer: string }> }).generateEntropyAndEncrypt({
        wordCount,
      })

      return {
        encryptionKey: result.encryptionKey,
        encryptedSeedBuffer: result.encryptedSeedBuffer,
        encryptedEntropyBuffer: result.encryptedEntropyBuffer,
      }
    } catch (error) {
      console.error('Failed to generate entropy and encrypt:', {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        fullError: error,
      })
      
      const errorMessage =
        error instanceof Error 
          ? `${error.message}${error.stack ? `\nStack: ${error.stack}` : ''}`
          : String(error)
      throw new Error(`Failed to generate entropy: ${errorMessage}`)
    }
  }

  /**
   * Get mnemonic from encrypted entropy (for display purposes only - never stored)
   */
  static async getMnemonicFromEntropy(
    encryptedEntropy: string,
    encryptionKey: string
  ): Promise<{
    mnemonic: string
  }> {
    const store = getWorkletStore()
    const state = store.getState()
    
    if (!state.isWorkletStarted || !state.hrpc) {
      throw new Error('Worklet must be started before getting mnemonic')
    }

    try {
      // getMnemonicFromEntropy may not be in types yet
      const result = await (state.hrpc as unknown as { getMnemonicFromEntropy: (options: { encryptedEntropy: string; encryptionKey: string }) => Promise<{ mnemonic: string }> }).getMnemonicFromEntropy({
        encryptedEntropy,
        encryptionKey,
      })

      return {
        mnemonic: result.mnemonic,
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      console.error('Failed to get mnemonic from entropy:', error)
      throw new Error(`Failed to get mnemonic: ${errorMessage}`)
    }
  }

  /**
   * Get seed and entropy from mnemonic phrase (for importing existing wallets)
   */
  static async getSeedAndEntropyFromMnemonic(
    mnemonic: string
  ): Promise<{
    encryptionKey: string
    encryptedSeedBuffer: string
    encryptedEntropyBuffer: string
  }> {
    const store = getWorkletStore()
    const state = store.getState()
    
    if (!state.isWorkletStarted || !state.hrpc) {
      throw new Error('Worklet must be started before getting seed and entropy from mnemonic')
    }

    try {
      // getSeedAndEntropyFromMnemonic may not be in types yet
      const result = await (state.hrpc as unknown as { getSeedAndEntropyFromMnemonic: (options: { mnemonic: string }) => Promise<{ encryptionKey: string; encryptedSeedBuffer: string; encryptedEntropyBuffer: string }> }).getSeedAndEntropyFromMnemonic({
        mnemonic,
      })

      return {
        encryptionKey: result.encryptionKey,
        encryptedSeedBuffer: result.encryptedSeedBuffer,
        encryptedEntropyBuffer: result.encryptedEntropyBuffer,
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      console.error('Failed to get seed and entropy from mnemonic:', error)
      throw new Error(`Failed to get seed and entropy from mnemonic: ${errorMessage}`)
    }
  }

  /**
   * Initialize both worklet and WDK in one call (convenience method) - ONLY encrypted
   */
  static async initializeWorklet(
    options: {
      encryptionKey: string
      encryptedSeed: string
      networkConfigs: NetworkConfigs
    }
  ): Promise<void> {
    // Convenience method that does both steps - ONLY encrypted approach
    await this.startWorklet(options.networkConfigs)
    await this.initializeWDK({
      encryptionKey: options.encryptionKey,
      encryptedSeed: options.encryptedSeed,
    })
  }

  static reset(): void {
    const workletStore = getWorkletStore()
    const walletStore = getWalletStore()

    const { worklet } = workletStore.getState()
    if (worklet) {
      // Add cleanup logic here if worklet has a cleanup method
      // worklet.cleanup?.()
    }

    workletStore.setState({
      worklet: null,
      hrpc: null,
      ipc: null,
      isWorkletStarted: false,
      isInitialized: false,
      isLoading: false,
      error: null,
      encryptedSeed: null,
      encryptionKey: null,
      networkConfigs: null,
      workletStartResult: null,
      wdkInitResult: null,
    })
    
    // Reset wallet store
    walletStore.setState({
      addresses: {},
      walletLoading: {},
      balances: {},
      balanceLoading: {},
      lastBalanceUpdate: {},
    })
  }

  static clearError(): void {
    const store = getWorkletStore()
    store.setState({ error: null })
  }

  /**
   * Get address for a specific network and account index
   */
  static async getAddress(
    network: string,
    accountIndex = 0
  ): Promise<string> {
    const workletStore = getWorkletStore()
    const walletStore = getWalletStore()
    const workletState = workletStore.getState()
    const walletState = walletStore.getState()

    const cachedAddress = walletState.addresses[network]?.[accountIndex]
    if (cachedAddress) {
      return cachedAddress
    }

    if (!workletState.isInitialized || !workletState.hrpc) {
      throw new Error('WDK not initialized')
    }

    const loadingKey = `${network}-${accountIndex}`
    
    try {
      walletStore.setState((prev) => ({
        walletLoading: { ...prev.walletLoading, [loadingKey]: true },
      }))

      // Get fresh state to ensure hrpc is still available
      const currentWorkletState = workletStore.getState()
      if (!currentWorkletState.hrpc) {
        throw new Error('HRPC instance not available')
      }

      // Call getAddress method on the account
      const response = await currentWorkletState.hrpc.callMethod({
        methodName: 'getAddress',
        network,
        accountIndex,
        args: null,
      })

      if (!response.result) {
        throw new Error('Failed to get address from worklet')
      }

      const address = JSON.parse(response.result) as string

      // Cache the address
      walletStore.setState((prev) => ({
        addresses: {
          ...prev.addresses,
          [network]: {
            ...(prev.addresses[network] || {}),
            [accountIndex]: address,
          },
        },
        walletLoading: { ...prev.walletLoading, [loadingKey]: false },
      }))

      return address
    } catch (error) {
      walletStore.setState((prev) => ({
        walletLoading: { ...prev.walletLoading, [loadingKey]: false },
      }))
      throw error
    }
  }

  /**
   * Call a method on a wallet account
   */
  static async callAccountMethod<T = unknown>(
    network: string,
    accountIndex: number,
    methodName: string,
    args?: unknown
  ): Promise<T> {
    const workletStore = getWorkletStore()
    const workletState = workletStore.getState()
    
    if (!workletState.isInitialized || !workletState.hrpc) {
      throw new Error('WDK not initialized')
    }

    try {
      // Get fresh state to ensure hrpc is still available
      const currentWorkletState = workletStore.getState()
      if (!currentWorkletState.hrpc) {
        throw new Error('HRPC instance not available')
      }

      const response = await currentWorkletState.hrpc.callMethod({
        methodName,
        network,
        accountIndex,
        args: args ? JSON.stringify(args) : null,
      })

      if (!response.result) {
        throw new Error(`Method ${methodName} returned no result`)
      }

      // Parse the result and handle BigInt values
      const parsed = JSON.parse(response.result) as T
      
      // Recursively convert BigInt values to strings to prevent serialization errors
      const convertBigIntToString = (value: unknown): unknown => {
        if (typeof value === 'bigint') {
          return value.toString()
        }
        if (Array.isArray(value)) {
          return value.map(convertBigIntToString)
        }
        if (value && typeof value === 'object') {
          return Object.fromEntries(
            Object.entries(value).map(([key, val]) => [key, convertBigIntToString(val)])
          )
        }
        return value
      }
      
      return convertBigIntToString(parsed) as T
    } catch (error) {
      console.error(`Failed to call ${methodName} on ${network}:${accountIndex}:`, error)
      throw error
    }
  }

  /**
   * Update balance for a specific wallet, network, and token
   */
  static updateBalance(
    accountIndex: number,
    network: string,
    tokenAddress: string | null,
    balance: string
  ): void {
    const walletStore = getWalletStore()
    const tokenKey = tokenAddress || 'native'
    
    walletStore.setState((prev) => ({
      balances: {
        ...prev.balances,
        [network]: {
          ...(prev.balances[network] || {}),
          [accountIndex]: {
            ...(prev.balances[network]?.[accountIndex] || {}),
            [tokenKey]: balance,
          },
        },
      },
    }))
  }

  /**
   * Get balance for a specific wallet, network, and token
   */
  static getBalance(
    accountIndex: number,
    network: string,
    tokenAddress: string | null
  ): string | null {
    const walletStore = getWalletStore()
    const walletState = walletStore.getState()
    const tokenKey = tokenAddress || 'native'
    
    return walletState.balances[network]?.[accountIndex]?.[tokenKey] || null
  }

  /**
   * Get all balances for a specific wallet and network
   */
  static getBalancesForWallet(
    accountIndex: number,
    network: string
  ): Record<string, string> | null {
    const walletStore = getWalletStore()
    const walletState = walletStore.getState()
    
    return walletState.balances[network]?.[accountIndex] || null
  }

  /**
   * Set balance loading state
   */
  static setBalanceLoading(
    network: string,
    accountIndex: number,
    tokenAddress: string | null,
    loading: boolean
  ): void {
    const walletStore = getWalletStore()
    const tokenKey = tokenAddress || 'native'
    const loadingKey = `${network}-${accountIndex}-${tokenKey}`
    
    walletStore.setState((prev) => {
      if (loading) {
        return {
          balanceLoading: {
            ...prev.balanceLoading,
            [loadingKey]: true,
          },
        }
      } else {
        const { [loadingKey]: _, ...rest } = prev.balanceLoading
        return {
          balanceLoading: rest,
        }
      }
    })
  }

  /**
   * Check if balance is loading
   */
  static isBalanceLoading(
    network: string,
    accountIndex: number,
    tokenAddress: string | null
  ): boolean {
    const walletStore = getWalletStore()
    const walletState = walletStore.getState()
    const tokenKey = tokenAddress || 'native'
    const loadingKey = `${network}-${accountIndex}-${tokenKey}`
    
    return walletState.balanceLoading[loadingKey] || false
  }

  /**
   * Update last balance update timestamp
   */
  static updateLastBalanceUpdate(
    network: string,
    accountIndex: number
  ): void {
    const walletStore = getWalletStore()
    const now = Date.now()
    
    walletStore.setState((prev) => ({
      lastBalanceUpdate: {
        ...prev.lastBalanceUpdate,
        [network]: {
          ...(prev.lastBalanceUpdate[network] || {}),
          [accountIndex]: now,
        },
      },
    }))
  }

  /**
   * Get last balance update timestamp
   */
  static getLastBalanceUpdate(
    network: string,
    accountIndex: number
  ): number | null {
    const walletStore = getWalletStore()
    const walletState = walletStore.getState()
    
    return walletState.lastBalanceUpdate[network]?.[accountIndex] || null
  }

  /**
   * Clear all balances (useful for wallet reset)
   */
  static clearBalances(): void {
    const walletStore = getWalletStore()
    
    walletStore.setState({
      balances: {},
      balanceLoading: {},
      lastBalanceUpdate: {},
    })
  }
}

