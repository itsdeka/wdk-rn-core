/**
 * Worklet Lifecycle Service
 * 
 * Handles worklet lifecycle operations: starting, initializing, and cleaning up worklets.
 * This service is focused solely on worklet lifecycle management.
 */

// External packages
import { Worklet } from 'react-native-bare-kit'
import { HRPC } from 'pear-wrk-wdk'

// Local imports
import type { NetworkConfigs } from '../types'
import { getWorkletStore } from '../store/workletStore'
import { getWalletStore } from '../store/walletStore'
import { asExtendedHRPC } from '../types/hrpc'
import { DEFAULT_MNEMONIC_WORD_COUNT } from '../utils/constants'
import { log, logError, logWarn } from '../utils/logger'
import { normalizeError } from '../utils/errorUtils'

/**
 * Extended HRPC type that may have a cleanup method
 */
interface HRPCWithCleanup extends HRPC {
  cleanup?: () => Promise<void> | void
}

/**
 * Extended Worklet type that may have cleanup methods
 */
interface WorkletWithCleanup extends Worklet {
  cleanup?: () => Promise<void> | void
  destroy?: () => Promise<void> | void
  stop?: () => Promise<void> | void
}

/**
 * Type guard to check if HRPC has cleanup method
 */
function hasHRPCCleanup(hrpc: HRPC): hrpc is HRPCWithCleanup {
  return typeof (hrpc as unknown as Record<string, unknown>).cleanup === 'function'
}

/**
 * Type guard to check if Worklet has cleanup methods
 */
function hasWorkletCleanup(worklet: Worklet): worklet is WorkletWithCleanup {
  const w = worklet as unknown as Record<string, unknown>
  return (
    typeof w.cleanup === 'function' ||
    typeof w.destroy === 'function' ||
    typeof w.stop === 'function'
  )
}

/**
 * Worklet Lifecycle Service
 * 
 * Provides methods for managing worklet lifecycle: start, initialize, cleanup, reset.
 */
export class WorkletLifecycleService {
  /**
   * Cleanup worklet resources (HRPC and Worklet instances)
   * Handles cleanup gracefully, continuing even if individual steps fail
   */
  private static async cleanupWorkletResources(
    hrpc: HRPC | null,
    worklet: Worklet | null
  ): Promise<void> {
    try {
      // Cleanup HRPC if it has a cleanup method
      if (hrpc && hasHRPCCleanup(hrpc)) {
        const hrpcWithCleanup = hrpc as HRPCWithCleanup
        if (hrpcWithCleanup.cleanup) {
          await hrpcWithCleanup.cleanup()
        }
      }
      
      // Cleanup worklet if it has cleanup methods
      if (worklet && hasWorkletCleanup(worklet)) {
        const workletWithCleanup = worklet as WorkletWithCleanup
        if (typeof workletWithCleanup.cleanup === 'function') {
          await workletWithCleanup.cleanup()
        } else if (typeof workletWithCleanup.destroy === 'function') {
          await workletWithCleanup.destroy()
        } else if (typeof workletWithCleanup.stop === 'function') {
          await workletWithCleanup.stop()
        }
      }
    } catch (error) {
      logWarn('Error cleaning up worklet resources:', error)
      // Continue even if cleanup fails
    }
  }
  /**
   * Start the worklet with network configurations
   */
  static async startWorklet(
    networkConfigs: NetworkConfigs
  ): Promise<void> {
    const store = getWorkletStore()
    const state = store.getState()
    
    if (state.isLoading) {
      logWarn('Worklet initialization already in progress')
      return
    }

    if (state.isWorkletStarted) {
      log('Worklet already started')
      return
    }

    try {
      store.setState({ 
        error: null, 
        isLoading: true,
      })

      // Cleanup existing worklet if present
      const { worklet: existingWorklet, hrpc: existingHrpc } = store.getState()
      if (existingWorklet || existingHrpc) {
        await this.cleanupWorkletResources(existingHrpc, existingWorklet)
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
      const normalizedError = normalizeError(error, false, {
        component: 'WorkletLifecycleService',
        operation: 'startWorklet'
      })
      logError('[WorkletLifecycleService] Failed to start worklet:', normalizedError)
      store.setState({
        error: normalizedError.message,
        isLoading: false,
        worklet: null,
        hrpc: null,
        ipc: null,
        isWorkletStarted: false,
      })
      throw normalizedError
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
      log('WDK already initialized with the same encrypted seed')
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

      const extendedHrpc = asExtendedHRPC(currentState.hrpc)
      const result = await extendedHrpc.initializeWDK({
        encryptionKey: options.encryptionKey,
        encryptedSeed: options.encryptedSeed,
        config: JSON.stringify(currentState.networkConfigs || {}),
      })

      // NEVER store seed phrase
      // Extract status from result (inline type check since only used once)
      const wdkInitResult: { status?: string | null } | null = 
        (result !== null && typeof result === 'object' && 'status' in result)
          ? { status: (result as { status?: string | null }).status }
          : null

      store.setState({
        isInitialized: true,
        isLoading: false,
        encryptedSeed: options.encryptedSeed,
        encryptionKey: options.encryptionKey,
        wdkInitResult,
        error: null,
      })
    } catch (error) {
      const normalizedError = normalizeError(error, false, {
        component: 'WorkletLifecycleService',
        operation: 'initializeWDK'
      })
      logError('[WorkletLifecycleService] Failed to initialize WDK:', normalizedError)
      store.setState({
        error: normalizedError.message,
        isLoading: false,
        isInitialized: false,
      })
      throw normalizedError
    }
  }

  /**
   * Generate entropy and encrypt (for creating new wallets)
   */
  static async generateEntropyAndEncrypt(
    wordCount: 12 | 24 = DEFAULT_MNEMONIC_WORD_COUNT
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
      const extendedHrpc = asExtendedHRPC(state.hrpc)
      const result = await extendedHrpc.generateEntropyAndEncrypt({
        wordCount,
      })

      return {
        encryptionKey: result.encryptionKey,
        encryptedSeedBuffer: result.encryptedSeedBuffer,
        encryptedEntropyBuffer: result.encryptedEntropyBuffer,
      }
    } catch (error) {
      const normalizedError = normalizeError(error, false, {
        component: 'WorkletLifecycleService',
        operation: 'generateEntropyAndEncrypt'
      })
      logError('[WorkletLifecycleService] Failed to generate entropy and encrypt:', normalizedError)
      throw new Error(`Failed to generate entropy: ${normalizedError.message}`)
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
      const extendedHrpc = asExtendedHRPC(state.hrpc)
      const result = await extendedHrpc.getMnemonicFromEntropy({
        encryptedEntropy,
        encryptionKey,
      })

      return {
        mnemonic: result.mnemonic,
      }
    } catch (error) {
      const normalizedError = normalizeError(error, false, {
        component: 'WorkletLifecycleService',
        operation: 'getMnemonicFromEntropy'
      })
      logError('[WorkletLifecycleService] Failed to get mnemonic from entropy:', normalizedError)
      throw new Error(`Failed to get mnemonic: ${normalizedError.message}`)
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
      const extendedHrpc = asExtendedHRPC(state.hrpc)
      const result = await extendedHrpc.getSeedAndEntropyFromMnemonic({
        mnemonic,
      })

      return {
        encryptionKey: result.encryptionKey,
        encryptedSeedBuffer: result.encryptedSeedBuffer,
        encryptedEntropyBuffer: result.encryptedEntropyBuffer,
      }
    } catch (error) {
      const normalizedError = normalizeError(error, false, {
        component: 'WorkletLifecycleService',
        operation: 'getSeedAndEntropyFromMnemonic'
      })
      logError('[WorkletLifecycleService] Failed to get seed and entropy from mnemonic:', normalizedError)
      throw new Error(`Failed to get seed and entropy from mnemonic: ${normalizedError.message}`)
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

  /**
   * Cleanup worklet resources
   * Properly disposes of worklet instances and clears all state
   */
  static async cleanup(): Promise<void> {
    const workletStore = getWorkletStore()
    const walletStore = getWalletStore()

    const { worklet, hrpc } = workletStore.getState()
    
    // Use extracted cleanup method
    await this.cleanupWorkletResources(hrpc, worklet)

    // Clear all state including sensitive data
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

  /**
   * Reset worklet state (synchronous)
   * For async cleanup, use cleanup() instead
   */
  static reset(): void {
    const workletStore = getWorkletStore()
    const walletStore = getWalletStore()

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

  /**
   * Clear error state
   */
  static clearError(): void {
    const store = getWorkletStore()
    store.setState({ error: null })
  }
}

