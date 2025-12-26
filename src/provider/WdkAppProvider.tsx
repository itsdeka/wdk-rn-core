/**
 * WdkAppProvider
 *
 * App-level orchestration provider that composes existing WDK hooks.
 * Manages the complete initialization flow:
 * 1. Start worklet immediately on app open
 * 2. Check if wallet exists
 * 3. Wait for biometric authentication (if required)
 * 4. Initialize/load wallet
 *
 * This provider is generic and reusable - it doesn't know about app-specific
 * concerns like auth state or UI branding.
 */

import React, { createContext, useContext, useEffect, useRef, useState, useMemo, useCallback } from 'react'
import type { SecureStorage } from '@tetherto/wdk-rn-secure-storage'
import type { NetworkConfigs, TokenConfigs } from '../types'
import { useWorklet } from '../hooks/useWorklet'
import { useWalletSetup } from '../hooks/useWalletSetup'
import { useWallet } from '../hooks/useWallet'
import { useBalanceFetcher } from '../hooks/useBalanceFetcher'
import { getWalletStore } from '../store/walletStore'
import { getWorkletStore } from '../store/workletStore'
import { validateNetworkConfigs, validateTokenConfigs, validateBalanceRefreshInterval } from '../utils/validation'
import { normalizeError } from '../utils/errorUtils'


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
  /** Waiting for biometric authentication */
  needsBiometric: boolean
  /** Call this after biometric authentication succeeds */
  completeBiometric: () => void
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
  /** Secure storage instance */
  secureStorage: SecureStorage
  /** Network configurations */
  networkConfigs: NetworkConfigs
  /** Token configurations for balance fetching */
  tokenConfigs: TokenConfigs
  /** Whether biometric authentication is required before wallet initialization */
  requireBiometric?: boolean
  /** Whether to automatically fetch balances after wallet initialization */
  autoFetchBalances?: boolean
  /** Balance refresh interval in milliseconds (0 = no auto-refresh) */
  balanceRefreshInterval?: number
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
  secureStorage,
  networkConfigs,
  tokenConfigs,
  requireBiometric = false,
  autoFetchBalances = true,
  balanceRefreshInterval = 30000, // 30 seconds
  children,
}: WdkAppProviderProps) {
  // Validate props on mount
  React.useEffect(() => {
    try {
      validateNetworkConfigs(networkConfigs)
      validateTokenConfigs(tokenConfigs)
      validateBalanceRefreshInterval(balanceRefreshInterval)
    } catch (error) {
      console.error('[WdkAppProvider] Invalid props:', error)
      // In development, throw to catch issues early
      if (process.env.NODE_ENV !== 'production') {
        throw error
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only validate on mount

  // Track initialization state
  const [hasWalletChecked, setHasWalletChecked] = useState(false)
  const [walletExists, setWalletExists] = useState<boolean | null>(null)
  const [biometricAuthenticated, setBiometricAuthenticated] = useState(!requireBiometric)
  const [initializationError, setInitializationError] = useState<Error | null>(null)
  const [walletInitError, setWalletInitError] = useState<Error | null>(null)
  const [isFetchingBalances, setIsFetchingBalances] = useState(false)

  // Use refs to track initialization attempts without causing re-renders
  const hasAttemptedWorkletInitialization = useRef(false)
  const hasAttemptedWalletInitialization = useRef(false)
  const hasCompletedInitialBalanceFetch = useRef(false)

  // Worklet hooks
  const {
    isWorkletStarted,
    isInitialized: isWorkletInitialized,
    isLoading: isWorkletLoading,
    startWorklet,
  } = useWorklet()

  // Wallet setup hooks
  const {
    initializeWallet,
    hasWallet,
    isInitializing: isWalletInitializing,
  } = useWalletSetup(secureStorage, networkConfigs)

  // Wallet state hook - to check if wallet is actually initialized
  const { isInitialized: walletInitialized } = useWallet()

  // Balance fetcher hook
  const { fetchAllBalances } = useBalanceFetcher({
    walletStore: getWalletStore(),
    tokenConfigs,
  })

  // Initialize worklet immediately when component mounts
  useEffect(() => {
    // If worklet is already initialized, don't do anything
    if (isWorkletInitialized) {
      return
    }

    // Check if worklet is already loading
    if (isWorkletLoading) {
      return
    }

    // Only attempt initialization once per app session
    if (hasAttemptedWorkletInitialization.current) {
      return
    }

    const initializeWorklet = async () => {
      try {
        console.log('[WdkAppProvider] Starting worklet initialization...')
        setInitializationError(null)
        hasAttemptedWorkletInitialization.current = true

        await startWorklet(networkConfigs)
        console.log('[WdkAppProvider] Worklet started successfully')
      } catch (error) {
        const err = normalizeError(error)
        console.error('[WdkAppProvider] Failed to initialize worklet:', error)
        setInitializationError(err)
        // Don't block the app - allow user to proceed even if initialization fails
      }
    }

    initializeWorklet()
  }, [isWorkletInitialized, isWorkletLoading, networkConfigs, startWorklet])

  // Check if wallet exists when worklet is started (not fully initialized yet)
  useEffect(() => {
    if (!isWorkletStarted || hasWalletChecked) {
      return
    }

    let cancelled = false

    const checkWallet = async () => {
      try {
        console.log('[WdkAppProvider] Checking if wallet exists...')
        const walletExistsResult = await hasWallet()
        console.log('[WdkAppProvider] Wallet check result:', walletExistsResult)
        if (!cancelled) {
          setHasWalletChecked(true)
          setWalletExists(walletExistsResult)
        }
      } catch (error) {
        console.error('[WdkAppProvider] Failed to check wallet:', error)
        if (!cancelled) {
          setHasWalletChecked(true)
          setWalletExists(false)
        }
      }
    }

    checkWallet()

    return () => {
      cancelled = true
    }
  }, [isWorkletStarted, hasWalletChecked, hasWallet])

  // Shared wallet initialization logic
  const performWalletInitialization = useCallback(async () => {
    try {
      console.log('[WdkAppProvider] Starting wallet initialization...')
      setWalletInitError(null)

      // Initialize wallet (create new if doesn't exist, or load existing)
      if (walletExists) {
        console.log('[WdkAppProvider] Loading existing wallet from secure storage...')
        await initializeWallet({ createNew: false })
        console.log('[WdkAppProvider] Existing wallet loaded successfully')
      } else {
        console.log('[WdkAppProvider] Creating new wallet...')
        await initializeWallet({ createNew: true })
        console.log('[WdkAppProvider] New wallet created successfully')
      }

      console.log('[WdkAppProvider] Wallet initialized successfully')
    } catch (error) {
      const err = normalizeError(error)
      console.error('[WdkAppProvider] Failed to initialize wallet:', error)
      
      // Attempt to clean up corrupted wallet data on any initialization error
      try {
        await secureStorage.deleteWallet()
        console.log('[WdkAppProvider] Deleted wallet data from secure storage after initialization failure')
      } catch (deleteError) {
        console.warn('[WdkAppProvider] Failed to delete wallet data:', deleteError)
        // Continue - we'll still set the error
      }
      
      setWalletInitError(err)
      // Store error so UI can display it with retry option
      throw err
    }
  }, [walletExists, initializeWallet, secureStorage])

  // Initialize wallet when worklet is started, wallet check is complete, and biometric auth is done
  useEffect(() => {
    if (!hasWalletChecked || !isWorkletStarted || !biometricAuthenticated) {
      return
    }

    // Only initialize once per session
    if (hasAttemptedWalletInitialization.current) {
      return
    }

    // Check if wallet is already initializing
    if (isWalletInitializing) {
      return
    }

    const initializeWalletFlow = async () => {
      hasAttemptedWalletInitialization.current = true
      await performWalletInitialization()
    }

    initializeWalletFlow()
  }, [
    hasWalletChecked,
    walletExists,
    isWorkletStarted,
    isWalletInitializing,
    biometricAuthenticated,
    performWalletInitialization,
  ])


  // Handler for completing biometric authentication
  const completeBiometric = () => {
    console.log('[WdkAppProvider] Biometric authentication completed')
    setBiometricAuthenticated(true)
  }

  // Handler for retrying initialization after an error
  const retry = useCallback(async () => {
    console.log('[WdkAppProvider] Retrying initialization...')
    // Reset error states
    setWalletInitError(null)
    setInitializationError(null)
    // Reset initialization attempt flag so we can try again
    hasAttemptedWalletInitialization.current = false

    // Retry wallet initialization directly
    if (!hasWalletChecked || !isWorkletStarted) {
      console.log('[WdkAppProvider] Cannot retry: prerequisite conditions not met')
      return
    }

    try {
      console.log('[WdkAppProvider] Retrying wallet initialization...')
      hasAttemptedWalletInitialization.current = true
      await performWalletInitialization()
    } catch (error) {
      // Error is already handled in performWalletInitialization
      // Just ensure the error state is set (it's already set in performWalletInitialization)
    }
  }, [hasWalletChecked, isWorkletStarted, performWalletInitialization])

  // Handler for manually refreshing balances
  const refreshBalances = useCallback(async () => {
    if (!walletInitialized || isFetchingBalances) {
      console.log('[WdkAppProvider] Cannot refresh balances: wallet not ready or already fetching')
      return
    }

    try {
      console.log('[WdkAppProvider] Manually refreshing balances...')
      setIsFetchingBalances(true)
      await fetchAllBalances()
      console.log('[WdkAppProvider] Manual balance refresh completed')
    } catch (error) {
      console.error('[WdkAppProvider] Failed to refresh balances:', error)
    } finally {
      setIsFetchingBalances(false)
    }
  }, [walletInitialized, isFetchingBalances, fetchAllBalances])

  // Calculate readiness state
  const isReady = useMemo(() => {
    // If biometric is required and not authenticated, not ready
    if (requireBiometric && !biometricAuthenticated) {
      return false
    }

    // If worklet isn't started, not ready
    if (!isWorkletStarted) {
      return false
    }

    // If we haven't checked wallet existence, not ready
    if (!hasWalletChecked) {
      return false
    }

    // If wallet is initializing, not ready
    if (isWalletInitializing) {
      return false
    }

    // If wallet should exist but isn't initialized yet, not ready
    if (walletExists && !walletInitialized) {
      return false
    }

    // If worklet+WDK isn't fully initialized, not ready
    if (!isWorkletInitialized) {
      return false
    }

    // All conditions met, ready
    return true
  }, [
    requireBiometric,
    biometricAuthenticated,
    isWorkletStarted,
    isWorkletInitialized,
    hasWalletChecked,
    isWalletInitializing,
    walletExists,
    walletInitialized,
  ])

  // Calculate whether we're waiting for biometric
  const needsBiometric = useMemo(() => {
    // Only need biometric if:
    // 1. Biometric is required
    // 2. Not authenticated yet
    // 3. Worklet is started (so we're at the stage where biometric is needed)
    // 4. Wallet exists (only need biometric to unlock existing wallet)
    return requireBiometric && !biometricAuthenticated && isWorkletStarted && walletExists === true
  }, [requireBiometric, biometricAuthenticated, isWorkletStarted, walletExists])

  // Calculate initializing state
  const isInitializing = useMemo(() => {
    return isWorkletLoading || isWalletInitializing || (!hasWalletChecked && isWorkletStarted)
  }, [isWorkletLoading, isWalletInitializing, hasWalletChecked, isWorkletStarted])

  // Automatic balance fetching after wallet initialization
  useEffect(() => {
    if (!autoFetchBalances || !walletInitialized || !isReady || hasCompletedInitialBalanceFetch.current) {
      return
    }

    const fetchBalances = async () => {
      try {
        console.log('[WdkAppProvider] Starting automatic balance fetch...')
        setIsFetchingBalances(true)
        await fetchAllBalances()
        console.log('[WdkAppProvider] Automatic balance fetch completed')
        hasCompletedInitialBalanceFetch.current = true
      } catch (error) {
        console.error('[WdkAppProvider] Failed to fetch balances:', error)
      } finally {
        setIsFetchingBalances(false)
      }
    }

    fetchBalances()
  }, [autoFetchBalances, walletInitialized, isReady, fetchAllBalances])

  // Auto-refresh balances at specified interval
  useEffect(() => {
    if (!autoFetchBalances || !balanceRefreshInterval || balanceRefreshInterval <= 0) {
      return
    }

    if (!isReady) {
      return
    }

    const interval = setInterval(async () => {
      // Skip if already fetching to avoid overlapping requests
      // Check current state to avoid stale closures
      const workletState = getWorkletStore().getState()
      if (!workletState.isInitialized) {
        return
      }
      
      try {
        console.log('[WdkAppProvider] Auto-refreshing balances...')
        setIsFetchingBalances(true)
        await fetchAllBalances()
        console.log('[WdkAppProvider] Balance auto-refresh completed')
      } catch (error) {
        console.error('[WdkAppProvider] Failed to auto-refresh balances:', error)
      } finally {
        setIsFetchingBalances(false)
      }
    }, balanceRefreshInterval)

    return () => clearInterval(interval)
  }, [autoFetchBalances, balanceRefreshInterval, isReady, fetchAllBalances])

  const contextValue: WdkAppContextValue = useMemo(
    () => ({
      isReady,
      isInitializing,
      walletExists,
      needsBiometric,
      completeBiometric,
      error: walletInitError || initializationError,
      retry,
      isFetchingBalances,
      refreshBalances,
    }),
    [isReady, isInitializing, walletExists, needsBiometric, walletInitError, initializationError, retry, isFetchingBalances, refreshBalances]
  )

  return <WdkAppContext.Provider value={contextValue}>{children}</WdkAppContext.Provider>
}

// Export context for use by the useWdkApp hook
export { WdkAppContext }

