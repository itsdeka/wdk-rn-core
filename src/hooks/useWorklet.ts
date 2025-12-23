// Local imports
import { getWorkletStore } from '../store/workletStore'
import { WorkletService } from '../services/workletService'
import type { WorkletStore } from '../store/workletStore'

/**
 * Hook to interact with the worklet
 * 
 * This is the main hook that components should use to access worklet functionality.
 * 
 * For wallet-specific operations (addresses, accounts), use `useWallet()` hook instead.
 * 
 * @example
 * ```tsx
 * const { hrpc, isInitialized, isLoading, startWorklet, initializeWDK, generateEntropyAndEncrypt, error } = useWorklet()
 * 
 * useEffect(() => {
 *   if (!isInitialized && !isLoading) {
 *     // Step 1: Start worklet
 *     await startWorklet(networkConfigs)
 *     // Step 2: Get encrypted seed from secure storage (or generate for new wallet)
 *     const { encryptionKey, encryptedSeedBuffer } = await generateEntropyAndEncrypt(12)
 *     // Step 3: Initialize WDK with encrypted seed (NEVER use plain seed phrase)
 *     await initializeWDK({ encryptionKey, encryptedSeed: encryptedSeedBuffer })
 *   }
 * }, [isInitialized, isLoading])
 * ```
 */
export function useWorklet() {
  const store = getWorkletStore()

  // Subscribe to state changes using Zustand selectors
  const isWorkletStarted = store((state: WorkletStore) => state.isWorkletStarted)
  const isInitialized = store((state: WorkletStore) => state.isInitialized)
  const isLoading = store((state: WorkletStore) => state.isLoading)
  const error = store((state: WorkletStore) => state.error)
  const hrpc = store((state: WorkletStore) => state.hrpc)
  const worklet = store((state: WorkletStore) => state.worklet)
  const workletStartResult = store((state: WorkletStore) => state.workletStartResult)
  const wdkInitResult = store((state: WorkletStore) => state.wdkInitResult)
  const encryptedSeed = store((state: WorkletStore) => state.encryptedSeed)
  const encryptionKey = store((state: WorkletStore) => state.encryptionKey)
  const networkConfigs = store((state: WorkletStore) => state.networkConfigs)

  // Actions are provided by WorkletService (static methods, no memoization needed)
  const actions = {
    startWorklet: WorkletService.startWorklet,
    initializeWDK: WorkletService.initializeWDK,
    generateEntropyAndEncrypt: WorkletService.generateEntropyAndEncrypt,
    getMnemonicFromEntropy: WorkletService.getMnemonicFromEntropy,
    getSeedAndEntropyFromMnemonic: WorkletService.getSeedAndEntropyFromMnemonic,
    initializeWorklet: WorkletService.initializeWorklet,
    reset: WorkletService.reset,
    clearError: WorkletService.clearError,
  }

  return {
    // State (reactive)
    isWorkletStarted,
    isInitialized,
    isLoading,
    error,
    hrpc,
    worklet,
    workletStartResult,
    wdkInitResult,
    encryptedSeed,
    encryptionKey,
    networkConfigs,
    // Actions
    ...actions,
  }
}

