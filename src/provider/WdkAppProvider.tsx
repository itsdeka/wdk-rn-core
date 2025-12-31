/**
 * WdkAppProvider
 *
 * App-level orchestration provider that composes existing WDK hooks.
 * Manages the complete initialization flow:
 * 1. Start worklet immediately on app open
 * 2. Check if wallet exists
 * 3. Initialize/load wallet
 *
 * This provider is generic and reusable - it doesn't know about app-specific
 * concerns like auth state or UI branding.
 */

import React, { createContext, useEffect, useMemo } from 'react'
import { createSecureStorage } from '@tetherto/wdk-rn-secure-storage'
import type { NetworkConfigs, TokenConfigs } from '../types'
import { useWdkInitialization } from '../hooks/useWdkInitialization'
import { useWdkBalanceSync } from '../hooks/useWdkBalanceSync'
import { useAbortController } from '../hooks/useAbortController'
import { WalletSetupService } from '../services/walletSetupService'
import { validateNetworkConfigs, validateTokenConfigs, validateBalanceRefreshInterval } from '../utils/validation'
import { normalizeError } from '../utils/errorUtils'
import { DEFAULT_BALANCE_REFRESH_INTERVAL_MS } from '../utils/constants'
import { logError } from '../utils/logger'


/**
 * Context state exposed to consumers
 */
export interface WdkAppContextValue {
  /** All initialization complete, app is ready */
  isReady: boolean
  /** Initialization in progress */
  isInitializing: boolean
  /** Whether a wallet exists in secure storage (null = checking) */
  walletExists: boolean | null
  /** Initialization error if any */
  error: Error | null
  /** Retry initialization after an error */
  retry: () => void
  /** Balance fetching is in progress */
  isFetchingBalances: boolean
  /** Refresh all balances manually */
  refreshBalances: () => Promise<void>
}

const WdkAppContext = createContext<WdkAppContextValue | null>(null)

/**
 * Provider props
 */
export interface WdkAppProviderProps {
  /** Network configurations */
  networkConfigs: NetworkConfigs
  /** Token configurations for balance fetching */
  tokenConfigs: TokenConfigs
  /** Whether to automatically fetch balances after wallet initialization */
  autoFetchBalances?: boolean
  /** Balance refresh interval in milliseconds (0 = no auto-refresh) */
  balanceRefreshInterval?: number
  /** Optional identifier for multi-wallet support (e.g., user email, user ID) */
  identifier?: string
  /** Whether wallet initialization is enabled. When false, skips wallet checking and initialization but still starts worklet. Defaults to true. */
  enabled?: boolean
  /** Child components (app content) */
  children: React.ReactNode
}

/**
 * WdkAppProvider - Orchestrates WDK initialization flow
 *
 * Composes useWorklet and useWalletSetup hooks into a unified initialization flow.
 * Automatically fetches balances when wallet is ready.
 */
export function WdkAppProvider({
  networkConfigs,
  tokenConfigs,
  autoFetchBalances = true,
  balanceRefreshInterval = DEFAULT_BALANCE_REFRESH_INTERVAL_MS,
  identifier,
  enabled = true,
  children,
}: WdkAppProviderProps) {
  // Create secureStorage singleton
  const secureStorage = useMemo(() => createSecureStorage(), [])

  // Set secureStorage in WalletSetupService
  useEffect(() => {
    WalletSetupService.setSecureStorage(secureStorage)
  }, [secureStorage])

  // Validate props on mount and when props change
  useEffect(() => {
    try {
      validateNetworkConfigs(networkConfigs)
      validateTokenConfigs(tokenConfigs)
      validateBalanceRefreshInterval(balanceRefreshInterval)
    } catch (error) {
      const err = normalizeError(error, true, { component: 'WdkAppProvider', operation: 'propsValidation' })
      logError('[WdkAppProvider] Invalid props:', err)
      // Always throw validation errors - they indicate programming errors
      throw err
    }
  }, [networkConfigs, tokenConfigs, balanceRefreshInterval])

  // AbortController hook for managing async operation cancellation
  const { getController } = useAbortController()

  // WDK initialization hook - handles worklet startup, wallet checking, and initialization
  const {
    walletExists,
    isInitializing: isInitializingFromHook,
    error: initializationError,
    retry,
    isWorkletStarted,
    walletInitialized,
  } = useWdkInitialization(
    secureStorage,
    networkConfigs,
    getController(),
    identifier,
    enabled
  )

  // Calculate readiness state
  const isReady = useMemo(() => {
    // If worklet isn't started, not ready
    if (!isWorkletStarted) {
      return false
    }

    // If wallet initialization is disabled, ready once worklet is started
    if (!enabled) {
      return true
    }

    // If there's an error, not ready (user needs to retry)
    if (initializationError) {
      return false
    }

    // If wallet is initializing, not ready
    if (isInitializingFromHook) {
      return false
    }

    // If wallet should exist but isn't initialized yet, not ready
    if (walletExists && !walletInitialized) {
      return false
    }

    // All conditions met, ready
    return true
  }, [
    isWorkletStarted,
    enabled,
    initializationError,
    isInitializingFromHook,
    walletExists,
    walletInitialized,
  ])

  // Balance sync hook - handles automatic and manual balance fetching
  const {
    isFetchingBalances,
    refreshBalances,
  } = useWdkBalanceSync(
    tokenConfigs,
    autoFetchBalances,
    balanceRefreshInterval,
    walletInitialized,
    isReady
  )

  const contextValue: WdkAppContextValue = useMemo(
    () => ({
      isReady,
      isInitializing: isInitializingFromHook,
      walletExists,
      error: initializationError,
      retry,
      isFetchingBalances,
      refreshBalances,
    }),
    [isReady, isInitializingFromHook, walletExists, initializationError, retry, isFetchingBalances, refreshBalances]
  )

  return (
    <WdkAppContext.Provider value={contextValue}>{children}</WdkAppContext.Provider>
  )
}

// Export context for use by the useWdkApp hook
export { WdkAppContext }

